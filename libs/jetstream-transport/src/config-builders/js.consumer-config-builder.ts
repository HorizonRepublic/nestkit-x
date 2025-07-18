import { AckPolicy, ConsumerConfig, DeliverPolicy, ReplayPolicy } from 'nats';
import { JsKind } from '@nestkit-x/jetstream-transport';

// Time constants in nanoseconds (NATS JetStream format)
const SECOND = 1e9;
const MINUTE = 60 * SECOND;

// Timeout constants in milliseconds (converted to nanoseconds)
const RPC_TIMEOUT_MS = 180_000; // 3 minutes
const EVENT_TIMEOUT_MS = 60_000; // 1 minute

/**
 * Builder class for creating NATS JetStream consumer configurations.
 * Provides a fluent API for configuring consumers with sensible defaults
 * and kind-specific optimizations for Event and Command consumers.
 *
 * Command consumers are optimized for RPC-style request/response patterns
 * with lower concurrency and single delivery attempts.
 * Event consumers are optimized for high-throughput event processing
 * with higher concurrency and retry capabilities.
 *
 * @example
 * ```typescript
 * const config = JsConsumerConfigBuilder
 *   .create('my-service')
 *   .forKind(JsKind.Command)
 *   .with({ max_ack_pending: 10 })
 *   .build();
 * ```
 */
export class JsConsumerConfigBuilder {
  private readonly base: Readonly<ConsumerConfig>;
  private readonly service: string;
  private kind?: JsKind;
  private overrides: Partial<ConsumerConfig> = {};

  /**
   * Creates a new consumer builder instance.
   * @param service - The service name used for consumer naming
   */
  private constructor(service: string) {
    this.service = service;

    this.base = Object.freeze<ConsumerConfig>({
      durable_name: '',
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
      ack_policy: AckPolicy.Explicit,
      ack_wait: 0,
      max_deliver: 1,
      max_ack_pending: 1,
    });
  }

  /**
   * Creates a new consumer builder instance for the specified service.
   * @param service - The service name used for consumer naming
   * @returns A new builder instance
   */
  public static create(service: string): JsConsumerConfigBuilder {
    return new JsConsumerConfigBuilder(service);
  }

  /**
   * Sets the consumer kind (Event or Command) and applies kind-specific defaults.
   * This method must be called before build().
   * @param kind - The type of consumer to create
   * @returns The builder instance for method chaining
   */
  public forKind(kind: JsKind): this {
    this.kind = kind;
    return this;
  }

  /**
   * Applies custom configuration overrides to the consumer.
   * These overrides take precedence over kind-specific defaults.
   * @param partial - Partial consumer configuration to merge
   * @returns The builder instance for method chaining
   */
  public with(partial: Partial<ConsumerConfig>): this {
    Object.assign(this.overrides, partial);
    return this;
  }

  /**
   * Builds the final consumer configuration by combining base defaults,
   * kind-specific settings, and user overrides.
   * @returns The complete consumer configuration
   * @throws Error if forKind() was not called before build()
   */
  public build(): ConsumerConfig {
    if (!this.kind) {
      throw new Error(`${JsConsumerConfigBuilder.name}: call forKind() before build()`);
    }

    const perKind = this.getKindSpecificConfig(this.kind);

    return {
      ...this.base,
      ...perKind,
      ...this.overrides, // User overrides have highest priority
    };
  }

  /**
   * Returns kind-specific configuration optimized for Event or Command consumers.
   *
   * Command consumers (RPC-style):
   * - Lower concurrency (max_ack_pending: 5)
   * - Single delivery attempt (max_deliver: 1)
   * - Longer ack timeout for complex operations (3 minutes)
   *
   * Event consumers (high throughput):
   * - Higher concurrency (max_ack_pending: 50)
   * - Multiple delivery attempts with retries (max_deliver: 5)
   * - Shorter ack timeout for quick processing (1 minute)
   *
   * @param kind - The consumer kind
   * @returns Kind-specific configuration object
   */
  private getKindSpecificConfig(kind: JsKind): Partial<ConsumerConfig> {
    const durable = `${this.service}_${kind}-consumer`;

    const baseConfig: Pick<ConsumerConfig, 'name' | 'durable_name'> = {
      durable_name: durable,
      name: durable,
    };

    if (kind === JsKind.Command) {
      return {
        ...baseConfig,
        ack_wait: this.msToNs(RPC_TIMEOUT_MS),
        max_deliver: 1,
        max_ack_pending: 5,
      };
    }

    if (kind === JsKind.Event) {
      return {
        ...baseConfig,
        ack_wait: this.msToNs(EVENT_TIMEOUT_MS),
        max_deliver: 5,
        max_ack_pending: 50,
      };
    }

    return baseConfig;
  }

  /**
   * Converts milliseconds to nanoseconds for NATS JetStream time values.
   * @param ms - Time in milliseconds
   * @returns Time in nanoseconds
   */
  private msToNs(ms: number): number {
    return ms * 1_000_000;
  }
}
