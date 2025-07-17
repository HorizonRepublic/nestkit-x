import { ConsumerConfig, ConsumerInfo, JetStreamManager } from 'nats';
import { catchError, defer, from, Observable, switchMap, tap } from 'rxjs';
import { LoggerService } from '@nestjs/common';
import {
  IJetstreamTransportOptions,
  JetStreamErrorCodes,
  JsConsumerConfigBuilder,
  JsKind,
} from '@nestkit-x/jetstream-transport';

/**
 * Manages NATS JetStream consumer lifecycle with robust error handling and idempotent operations.
 *
 * This manager implements a sophisticated consumer management strategy that handles race conditions,
 * concurrent consumer creation, and provides comprehensive logging for all operations. It follows
 * the "check-then-act" pattern to ensure consumers are properly created or retrieved.
 *
 * Key features:
 * - Idempotent consumer creation (safe to call multiple times)
 * - Race condition handling for concurrent consumer creation
 * - Comprehensive logging for debugging and monitoring
 * - Automatic fallback to existing consumers when creation conflicts occur
 * - Support for user-defined consumer configuration overrides
 *
 * @example
 * ```typescript
 * const consumerManager = new JsConsumerManager(jsm$, options, logger);
 * const consumerInfo = await consumerManager.ensure('my-stream', JsKind.Event).toPromise();
 * ```
 */
export class JsConsumerManager {
  /**
   * Creates a new JetStream consumer manager instance.
   *
   * @param jsm$ - Observable that emits JetStream manager instances when connection is ready
   * @param opts - JetStream transport configuration options containing service name and overrides
   * @param logger - Logger service for comprehensive operation tracking and debugging
   */
  constructor(
    private readonly jsm$: Observable<JetStreamManager>,
    private readonly opts: IJetstreamTransportOptions,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Ensures a durable consumer exists for the specified stream and kind with idempotent behavior.
   *
   * This method implements a two-phase approach to handle consumer creation safely:
   *
   * **Phase 1: Check Existence**
   * - Attempts to retrieve existing consumer information
   * - If successful, uses the existing consumer (no creation needed)
   * - If consumer not found (error 10014), proceeds to Phase 2
   *
   * **Phase 2: Create Consumer**
   * - Attempts to create a new consumer with the generated configuration
   * - If creation succeeds, returns the new consumer information
   * - If creation fails due to concurrent creation (error 10013), retrieves existing consumer
   *
   * **Race Condition Handling:**
   * This approach gracefully handles scenarios where multiple instances of the same service
   * start simultaneously and attempt to create the same consumer. The first instance succeeds
   * in creation, while subsequent instances detect the conflict and use the existing consumer.
   *
   * @param stream - The target stream name where the consumer will be created
   * @param kind - The consumer type (Event or Command) which determines configuration defaults
   * @returns Observable that emits ConsumerInfo when the consumer is ready for use
   *
   * @throws {Error} When consumer creation fails due to configuration issues or system errors
   *
   * @example
   * ```typescript
   * // Ensure an event consumer exists
   * const eventConsumer = await manager.ensure('my-service_ev-stream', JsKind.Event).toPromise();
   *
   * // Ensure a command consumer exists
   * const cmdConsumer = await manager.ensure('my-service_cmd-stream', JsKind.Command).toPromise();
   * ```
   */
  public ensure(stream: string, kind: JsKind): Observable<ConsumerInfo> {
    const cfg = this.buildConsumerConfig(kind);

    return this.jsm$.pipe(
      switchMap((jsm) =>
        // Phase 1: Check if consumer already exists
        // This prevents unnecessary creation attempts and provides immediate feedback
        defer(() => from(jsm.consumers.info(stream, cfg.durable_name!))).pipe(
          tap((existingConsumer) => {
            this.logger.log(`Consumer already exists, using existing: ${cfg.durable_name}`, {
              stream,
              kind,
              filter: cfg.filter_subject,
              // Consumer metrics for monitoring and debugging
              numPending: existingConsumer.num_pending,
              numAckPending: existingConsumer.num_ack_pending,
              delivered: existingConsumer.delivered,
            });
          }),
          catchError((infoErr) => {
            // Phase 2: Consumer doesn't exist, attempt creation
            if (infoErr.api_error?.err_code === JetStreamErrorCodes.ConsumerNotFound) {
              this.logger.log(`Consumer not found, creating new: ${cfg.durable_name}`, {
                stream,
                kind,
                filter: cfg.filter_subject,
              });

              return defer(() => from(jsm.consumers.add(stream, cfg))).pipe(
                tap(() => {
                  this.logger.log(`Consumer created successfully: ${cfg.durable_name}`, {
                    stream,
                    kind,
                    filter: cfg.filter_subject,
                  });
                }),
                catchError((createErr) => {
                  // Handle race condition: another instance created the consumer concurrently
                  if (createErr.api_error?.err_code === JetStreamErrorCodes.ConsumerExists) {
                    this.logger.log(
                      `Consumer created concurrently by another instance, using existing: ${cfg.durable_name}`,
                      {
                        stream,
                        kind,
                        filter: cfg.filter_subject,
                      },
                    );
                    // Retrieve information about the consumer created by another instance
                    return from(jsm.consumers.info(stream, cfg.durable_name!));
                  }

                  // Log unexpected creation errors for debugging
                  this.logger.error(`Failed to create consumer: ${cfg.durable_name}`, {
                    error: createErr.message,
                    errorCode: createErr.api_error?.err_code,
                    stream,
                    kind,
                    // Include configuration for debugging misconfigurations
                    config: cfg,
                  });
                  throw createErr;
                }),
              );
            }

            // Handle unexpected errors during consumer info retrieval
            this.logger.error(`Failed to get consumer info: ${cfg.durable_name}`, {
              error: infoErr.message,
              errorCode: infoErr.api_error?.err_code,
              stream,
              kind,
            });
            throw infoErr;
          }),
        ),
      ),
      tap((consumerInfo) => {
        // Final confirmation that consumer is ready with current metrics
        this.logger.log(`Consumer ready: ${cfg.durable_name}`, {
          stream,
          kind,
          // Real-time consumer metrics for monitoring
          numPending: consumerInfo.num_pending,
          numAckPending: consumerInfo.num_ack_pending,
          delivered: consumerInfo.delivered,
        });
      }),
    );
  }

  /**
   * Builds consumer configuration by combining multiple layers of settings with proper precedence.
   *
   * **Configuration Precedence (highest to lowest):**
   * 1. **Stream-specific filter subject** - Always applied to ensure proper message routing
   * 2. **User-provided overrides** - Custom settings from transport options
   * 3. **Kind-specific defaults** - Optimized settings for Event vs Command consumers
   * 4. **Base defaults** - Fundamental consumer settings from builder
   *
   * **Kind-Specific Optimizations:**
   * - **Event consumers**: Higher concurrency, multiple delivery attempts, longer timeouts
   * - **Command consumers**: Lower concurrency, single delivery attempt, shorter timeouts
   *
   * **Filter Subject Generation:**
   * The filter subject follows the pattern: `{serviceName}.{kind}.>` which ensures:
   * - Consumers only receive messages intended for their specific service
   * - Proper separation between event and command message streams
   * - Wildcard support for hierarchical message routing
   *
   * @param kind - The consumer type which determines default configuration values
   * @returns Complete consumer configuration ready for NATS JetStream consumer creation
   *
   * @example
   * ```typescript
   * // For service "user-service" and JsKind.Event:
   * // - durable_name: "user-service_ev_consumer"
   * // - filter_subject: "user-service.ev.>"
   * // - max_ack_pending: 50 (high concurrency for events)
   *
   * // For service "user-service" and JsKind.Command:
   * // - durable_name: "user-service_cmd_consumer"
   * // - filter_subject: "user-service.cmd.>"
   * // - max_ack_pending: 5 (low concurrency for commands)
   * ```
   */
  private buildConsumerConfig(kind: JsKind): ConsumerConfig {
    const builder = JsConsumerConfigBuilder.create(this.opts.serviceName).forKind(kind);

    // Apply user-provided overrides if available
    // This allows for service-specific customizations while maintaining defaults
    const userOverride = this.opts.consumerConfig?.[kind];
    if (userOverride) {
      builder.with(userOverride);
    }

    // Apply a stream-specific filter subject (the highest priority)
    // This ensures proper message routing and prevents cross-service message consumption
    return builder
      .with({
        filter_subject: `${this.opts.serviceName}.${kind}.>`,
      })
      .build();
  }
}
