import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';

/**
 * RPC Error Logging Interceptor.
 *
 * Logs errors that occur in RPC message handlers (microservices communication).
 * Provides structured logging with handler context and message payload for debugging.
 *
 * ## Features
 *
 * - **RPC-specific**: Only processes RPC contexts (TCP, Redis, RabbitMQ, etc.)
 * - **Handler identification**: Logs the method name that threw the error
 * - **Payload logging**: Includes the RPC message data for context
 * - **Full stack traces**: Complete error information for debugging
 * - **Transport agnostic**: Works with any NestJS microservice transport.
 *
 * ## Supported Transports
 *
 * - TCP
 * - Redis
 * - NATS
 * - RabbitMQ
 * - Kafka
 * - gRPC
 * - Custom transports.
 *
 * @example
 * ```typescript
 * // Register globally for microservice
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_INTERCEPTOR,
 *       useClass: RpcLogInterceptor,
 *     },
 *   ],
 * })
 * export class MicroserviceModule {}
 * ```
 *
 * @example
 * ```typescript
 * // Use on specific message handlers
 * @UseInterceptors(RpcLogInterceptor)
 * @Controller()
 * export class UserController {
 *   @MessagePattern('user.create')
 *   createUser(data: CreateUserDto) {
 *     // Error here will be logged with handler context
 *     throw new Error('Database connection failed');
 *   }
 * }
 * ```
 *
 * ## Log Output Example
 *
 * ```json
 * {
 *   "level": "error",
 *   "time": "2024-01-15T10:30:00.000Z",
 *   "context": "RpcLogInterceptor",
 *   "handler": "createUser",
 *   "rpc": {
 *     "data": {
 *       "email": "user@example.com",
 *       "name": "John Doe"
 *     }
 *   },
 *   "stack": "Error: Database connection failed..."
 * }
 * ```
 *
 * ## Error Handling Flow
 *
 * 1. Error occurs in RPC message handler
 * 2. Interceptor catches the error
 * 3. Logs error with structured context
 * 4. Re-throws error to RPC transport
 * 5. Transport returns error response to client
 * 6. Application continues running
 *
 * @see {@link HttpLogInterceptor} for HTTP error logging
 */
@Injectable()
export class RpcLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RpcLogInterceptor.name);

  /**
   * Intercepts RPC message handling and logs errors with handler context.
   *
   * Only processes RPC contexts (skips HTTP, WebSocket, etc.).
   * Extracts handler name and message data for comprehensive error logging.
   *
   * @param ctx Execution context containing RPC information.
   * @param next Call handler to proceed with message processing.
   * @returns Observable that catches and logs errors while re-throwing them.
   * @example
   */
  public intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'rpc') return next.handle();

    const rpcCtx = ctx.switchToRpc();

    // Extract handler method name for debugging
    const handler = ctx.getHandler().name || 'unknown';

    // Get the RPC message payload
    const data = rpcCtx.getData();

    return next.handle().pipe(
      catchError((err: Error) => {
        // Log with structured RPC context
        this.logger.error({ handler, rpc: { data } }, err.stack);

        // Re-throw to let RPC transport handle the error response
        return throwError(() => err);
      }),
    );
  }
}
