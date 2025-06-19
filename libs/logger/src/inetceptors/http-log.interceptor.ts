import { IncomingMessage } from 'http';

import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Environment, IAppConfig } from '@nestkit-x/core';
import { LevelWithSilent } from 'pino';
import { catchError, Observable, throwError } from 'rxjs';

import { CRITICAL_CLIENT_ERRORS, SKIP_IN_DEV, SUSPICIOUS_PATTERNS } from '../const';

type HttpLogLevel = Extract<LevelWithSilent, 'error' | 'silent' | 'warn'>;

/**
 * HTTP Error Logging Interceptor.
 *
 * Intelligently logs HTTP errors based on status codes and environment.
 * Designed to reduce noise in production while maintaining full visibility in development.
 *
 * ## Features
 *
 * - **Environment-aware logging**: Different log levels for dev/prod
 * - **Smart error classification**: 4xx vs 5xx errors handled differently
 * - **Request context**: Includes method, URL, request ID, and status code
 * - **Axios error support**: Handles external API call errors
 * - **Suspicious pattern detection**: Flags potentially malicious requests
 * - **Production noise reduction**: Silences common client errors (404, 401, etc.)
 *
 * ## Log Levels
 *
 * ### Production Environment
 * - **5xx errors**: Always logged as `error` (server issues)
 * - **Critical 4xx**: Logged as `error` (401, 403, 422, etc.)
 * - **Suspicious patterns**: Logged as `error` (potential attacks)
 * - **Other 4xx**: `silent` (reduce noise from client mistakes)
 *
 * ### Development Environment
 * - **5xx errors**: Logged as `error`
 * - **4xx errors**: Logged as `warn` (except common ones like 404)
 * - **Skip in dev**: Some errors are silenced (404, etc.).
 *
 * @example
 * ```TypeScript
 * // Register globally
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_INTERCEPTOR,
 *       useClass: HttpLogInterceptor,
 *     },
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * @example
 * ```typescript
 * // Use on specific controllers
 * @UseInterceptors(HttpLogInterceptor)
 * @Controller('api')
 * export class ApiController {}
 * ```
 *
 * ## Log Output Example
 *
 * ```json
 * {
 *   "level": "error",
 *   "time": "2024-01-15T10:30:00.000Z",
 *   "context": "HttpLogInterceptor",
 *   "http": {
 *     "method": "POST",
 *     "reqId": "019784f6-a7ba-74bb-b13a-e7e210fd3828",
 *     "statusCode": 500,
 *     "url": "/api/users"
 *   },
 *   "stack": "Error: Database connection failed..."
 * }
 * ```
 *
 * ## Configuration Constants
 *
 * - `CRITICAL_CLIENT_ERRORS`: Set of 4xx status codes that should be logged in production
 * - `SKIP_IN_DEV`: Set of status codes to silence in development
 * - `SUSPICIOUS_PATTERNS`: Regex patterns to detect potential security threats
 *
 * @see {@link RpcLogInterceptor} for RPC error logging
 */
@Injectable()
export class HttpLogInterceptor implements NestInterceptor {
  private readonly isProd: boolean;
  private readonly logger: Logger = new Logger(HttpLogInterceptor.name);

  public constructor(appConfig: IAppConfig) {
    this.isProd = appConfig.env === Environment.Prod;
  }

  /**
   * Intercepts HTTP requests and logs errors with appropriate context.
   *
   * Only processes HTTP requests (skips RPC, WebSocket, etc.).
   * Extracts request metadata and applies environment-specific logging rules.
   *
   * @param ctx Execution context containing request information.
   * @param next Call handler to proceed with request processing.
   * @returns Observable that catches and logs errors while re-throwing them.
   * @example -
   */
  public intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();

    const req = ctx.switchToHttp().getRequest<IncomingMessage>();
    const { id: requestId, method, url } = req;

    return next.handle().pipe(
      catchError((err: Error) => {
        const status = this.getStatusCode(err);
        const level = this.getLogLevel(status, err);

        if (level !== 'silent') {
          const logData = {
            http: { method, reqId: requestId, statusCode: status, url },
          };

          switch (level) {
            case 'error':
              this.logger.error(logData, err.stack);
              break;
            case 'warn':
              this.logger.warn(logData, err.stack);
              break;
            default:
              this.logger.error(logData, err.stack);
          }
        }

        return throwError(() => err);
      }),
    );
  }

  /**
   * Determines the appropriate log level based on status code and environment.
   *
   * Production strategy: Reduce noise by silencing common client errors
   * Development strategy: Show more information for debugging.
   *
   * @param status HTTP status code.
   * @param err The error object (used for suspicious pattern detection).
   * @returns Log level: 'error', 'warn', or 'silent'.
   * @example -
   */
  private getLogLevel(status: number, err: unknown): HttpLogLevel {
    if (status >= 500) return 'error';

    if (this.isProd) {
      return CRITICAL_CLIENT_ERRORS.has(status) || this.isSuspicious(err) ? 'error' : 'silent';
    }

    return SKIP_IN_DEV.has(status) ? 'silent' : 'warn';
  }

  /**
   * Extracts HTTP status code from various error types.
   *
   * Handles:
   * - NestJS HttpException instances
   * - Axios errors from external API calls
   * - Generic errors with status/statusCode properties
   * - Fallback to 500 for unknown errors.
   *
   * @param err Error object of an unknown type.
   * @returns HTTP status code (defaults to 500).
   * @example -
   */
  private getStatusCode(err: unknown): number {
    if (err instanceof HttpException) return err.getStatus();

    // Axios-подібні помилки
    if (this.isAxiosError(err)) {
      return err.response?.status ?? 500;
    }

    const maybeStatus = err as { status?: unknown; statusCode?: unknown };

    return Number(maybeStatus.status ?? maybeStatus.statusCode) || 500;
  }

  /**
   * Type guard to identify Axios errors.
   *
   * Axios errors have a specific structure with `isAxiosError: true`
   * and an optional response object containing status information.
   *
   * @param err Error object to check.
   * @returns True if error is from Axios.
   * @example -
   */
  private isAxiosError(
    err: unknown,
  ): err is { isAxiosError: true; response?: { status?: number } } {
    return (
      typeof err === 'object' &&
      err !== null &&
      'isAxiosError' in err &&
      (err as { isAxiosError: unknown }).isAxiosError === true
    );
  }

  /**
   * Detects suspicious error patterns that might indicate security threats.
   *
   * Analyzes error messages against predefined patterns to identify:
   * - SQL injection attempts
   * - Path traversal attacks
   * - XSS attempts
   * - Other malicious patterns.
   *
   * @param err Error object to analyze.
   * @returns True if an error message matches suspicious patterns.
   * @example -
   */
  private isSuspicious(err: unknown): boolean {
    const message = (err as { message?: string }).message?.toLowerCase() ?? '';

    return SUSPICIOUS_PATTERNS.some((re) => re.test(message));
  }
}
