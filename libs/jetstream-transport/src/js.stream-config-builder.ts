import { DiscardPolicy, RetentionPolicy, StorageType, StoreCompression, StreamConfig } from 'nats';
import { JsKind } from './enum';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

// Size constants in bytes
const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

// Time constants in nanoseconds (NATS JetStream format)
const SEC = 1e9;
const MIN = 60 * SEC;
const DAY = 24 * 60 * MIN;

/**
 * Builder class for creating NATS JetStream stream configurations.
 * Provides a fluent API for configuring streams with sensible defaults
 * and kind-specific optimizations for Event and Command streams.
 *
 * @example
 * ```TypeScript
 * const config = JsStreamConfigBuilder
 *   .create('my-service-name')
 *   .forKind(JsKind.Event)
 *   .with({ max_consumers: 200 })
 *   .build();
 * ```
 */
export class JsStreamConfigBuilder {
  private readonly base: Readonly<StreamConfig>;
  private readonly service: string;
  private kind?: JsKind;
  private overrides: Partial<StreamConfig> = {};

  /**
   * Creates a new builder instance.
   * @param service - The service name used for stream naming and subject patterns
   */
  private constructor(service: string) {
    this.service = service;

    this.base = Object.freeze<StreamConfig>({
      name: '',
      subjects: [],
      description: '',
      retention: RetentionPolicy.Workqueue,
      storage: StorageType.File,
      num_replicas: 1,

      // Resource limits
      max_consumers: 0,
      max_msgs_per_subject: 0,
      max_msgs: 0,
      max_age: 0,
      max_bytes: 0,
      max_msg_size: 0,

      // Stream behavior settings
      discard: DiscardPolicy.Old,
      discard_new_per_subject: false,
      duplicate_window: 0,
      first_seq: 0,
      sealed: false,
      mirror_direct: false,
      allow_direct: true,
      allow_rollup_hdrs: false,
      deny_delete: false,
      deny_purge: false,
      compression: StoreCompression.None,
    });
  }

  /**
   * Creates a new builder instance for the specified service.
   * @param service - The service name used for stream naming and subject patterns
   * @returns A new builder instance
   */
  public static create(service: string): JsStreamConfigBuilder {
    return new JsStreamConfigBuilder(service);
  }

  /**
   * Sets the stream kind (Event or Command) and applies kind-specific defaults.
   * This method must be called before build().
   * @param kind - The type of stream to create
   * @returns The builder instance for method chaining
   */
  public forKind(kind: JsKind): this {
    this.kind = kind;

    return this;
  }

  /**
   * Applies custom configuration overrides to the stream.
   * These overrides take precedence over kind-specific defaults.
   * @param partial - Partial stream configuration to merge
   * @returns The builder instance for method chaining
   */
  public with(partial: Partial<StreamConfig>): this {
    Object.assign(this.overrides, partial);

    return this;
  }

  /**
   * Builds the final stream configuration by combining base defaults,
   * kind-specific settings, and user overrides.
   * @returns The complete stream configuration
   * @throws Error if forKind() was not called before build()
   */
  public build(): StreamConfig {
    if (!this.kind) {
      throw new RuntimeException(`${JsStreamConfigBuilder.name}: call forKind() before build()`);
    }

    const name = `${this.service}_${this.kind}-stream`;
    const subjects = [`${this.service}.${this.kind}.>`];

    const perKind = this.getKindSpecificConfig(this.kind);

    return {
      ...this.base,
      ...perKind,
      ...this.overrides, // User overrides have the highest priority
      name,
      subjects,
      description: `${this.kind} stream for ${this.service}`,
    };
  }

  /**
   * Returns kind-specific configuration optimized for Event or Command streams.
   * Event streams are configured for high throughput and longer retention.
   * Command streams are configured for low latency and shorter retention.
   * @param kind - The stream kind
   * @returns Kind-specific configuration object
   */
  private getKindSpecificConfig(kind: JsKind): Partial<StreamConfig> {
    if (kind === JsKind.Event) {
      return {
        allow_rollup_hdrs: true,
        max_consumers: 100,
        max_msg_size: 10 * MB,
        max_msgs_per_subject: 5_000_000,
        max_msgs: 50_000_000,
        max_bytes: 5 * GB,
        max_age: 7 * DAY,
        duplicate_window: 2 * MIN,
      };
    }

    if (kind === JsKind.Command) {
      return {
        allow_rollup_hdrs: false,
        max_consumers: 50,
        max_msg_size: 5 * MB,
        max_msgs_per_subject: 100_000,
        max_msgs: 1_000_000,
        max_bytes: 100 * MB,
        max_age: 3 * MIN,
        duplicate_window: 30 * SEC,
      };
    }

    return {};
  }
}
