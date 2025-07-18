import { ConsumerConfig, ConsumerInfo, JetStreamManager } from 'nats';
import { catchError, defer, from, Observable, switchMap, tap } from 'rxjs';
import { LoggerService } from '@nestjs/common';
import {
  IJetstreamTransportOptions,
  JetStreamErrorCodes as EC,
  JsConsumerConfigBuilder,
  JsKind,
} from '@nestkit-x/jetstream-transport';

/**
 * Manages JetStream consumer lifecycle with idempotent creation and race condition handling.
 *
 * Implements check-then-create pattern for consumer management. Handles concurrent
 * consumer creation attempts by checking for existing consumers first, then creating
 * new ones if needed. Provides comprehensive error handling and logging throughout
 * the consumer lifecycle.
 */
export class JsConsumerManager {
  /**
   * Initializes consumer manager with JetStream manager and configuration.
   *
   * @param jsm$ - Observable that emits JetStream manager when available
   * @param opts - Transport configuration including service name and overrides
   * @param logger - Logger service for operation tracking
   */
  constructor(
    private readonly jsm$: Observable<JetStreamManager>,
    private readonly opts: IJetstreamTransportOptions,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Ensures durable consumer exists with idempotent behavior.
   *
   * Uses check-then-create pattern: first attempts to retrieve existing consumer,
   * then creates new one if not found. Handles race conditions during concurrent
   * creation attempts by falling back to existing consumer when creation conflicts occur.
   *
   * @param stream - Target stream name for consumer creation
   * @param kind - Consumer type determining configuration defaults
   * @returns Observable that emits consumer info when ready
   */
  ensure(stream: string, kind: JsKind): Observable<ConsumerInfo> {
    const cfg = this.buildConfig(kind);

    const isConsumerNotFound = (err: any): boolean =>
      err.api_error?.err_code === EC.ConsumerNotFound;

    return this.jsm$.pipe(
      switchMap((jsm) =>
        this.getExisting(jsm, stream, cfg).pipe(
          catchError((err) =>
            isConsumerNotFound(err)
              ? this.create(jsm, stream, cfg) // Create new consumer
              : this.throwInfoErr(err, stream, kind, cfg.durable_name!),
          ),
        ),
      ),
      tap((ci) => this.logger.log(`Consumer ready: ${cfg.name}`)),
    );
  }

  /**
   * Retrieves existing consumer information from JetStream.
   *
   * @param jsm - JetStream manager instance
   * @param stream - Target stream name
   * @param cfg - Consumer configuration
   * @returns Observable that emits consumer info if exists
   */
  private getExisting(jsm: JetStreamManager, stream: string, cfg: ConsumerConfig) {
    const extractKindFromDurable = (durable: string): string =>
      durable.split('_').pop() || 'unknown';

    return defer(() => from(jsm.consumers.info(stream, cfg.durable_name!))).pipe(
      tap((ci) =>
        this.logger.log(`Consumer using: ${cfg.durable_name}`, {
          stream,
          kind: extractKindFromDurable(cfg.durable_name!),
          numPending: ci.num_pending,
        }),
      ),
    );
  }

  /**
   * Creates new consumer with race condition handling.
   *
   * Attempts to create consumer and handles concurrent creation by falling back
   * to existing consumer info when creation conflicts occur.
   *
   * @param jsm - JetStream manager instance
   * @param stream - Target stream name
   * @param cfg - Consumer configuration
   * @returns Observable that emits consumer info when created or retrieved
   */
  private create(jsm: JetStreamManager, stream: string, cfg: ConsumerConfig) {
    const handleRaceCondition = (err: any): Observable<ConsumerInfo> => {
      const isConsumerExists = err.api_error?.err_code === EC.ConsumerExists;

      return isConsumerExists
        ? from(jsm.consumers.info(stream, cfg.durable_name!)) // Race condition - use existing
        : this.throwCreateErr(err, stream, cfg);
    };

    return defer(() => from(jsm.consumers.add(stream, cfg))).pipe(
      tap(() => this.logger.log(`Consumer created: ${cfg.durable_name}`, { stream })),
      catchError(handleRaceCondition),
    );
  }

  /**
   * Logs error and throws when consumer info retrieval fails.
   *
   * @param err - Error object from consumer info operation
   * @param stream - Target stream name
   * @param kind - Consumer type
   * @param durable - Durable consumer name
   * @throws Original error after logging
   */
  private throwInfoErr(err: any, stream: string, kind: JsKind, durable: string): never {
    this.logger.error(`Consumer info failed: ${durable}`, {
      stream,
      kind,
      error: err.message,
      code: err.api_error?.err_code,
    });
    throw err;
  }

  /**
   * Logs error and throws when consumer creation fails.
   *
   * @param err - Error object from consumer creation operation
   * @param stream - Target stream name
   * @param cfg - Consumer configuration that failed
   * @throws Original error after logging
   */
  private throwCreateErr(err: any, stream: string, cfg: ConsumerConfig): never {
    this.logger.error(`Consumer create failed: ${cfg.durable_name}`, {
      stream,
      error: err.message,
      code: err.api_error?.err_code,
      cfg,
    });
    throw err;
  }

  /**
   * Builds consumer configuration with builder pattern and user overrides.
   *
   * Combines kind-specific defaults with user-provided overrides and applies
   * service-specific filter subject for message routing.
   *
   * @param kind - Consumer type determining configuration defaults
   * @returns Complete consumer configuration
   */
  private buildConfig(kind: JsKind): ConsumerConfig {
    const builder = JsConsumerConfigBuilder.create(this.opts.serviceName).forKind(kind);

    const applyUserOverrides = (builder: JsConsumerConfigBuilder): void => {
      const userOverride = this.opts.consumerConfig?.[kind];
      if (userOverride) builder.with(userOverride);
    };

    const createFilterSubject = (): string => `${this.opts.serviceName}.${kind}.>`;

    applyUserOverrides(builder);

    return builder.with({ filter_subject: createFilterSubject() }).build();
  }
}
