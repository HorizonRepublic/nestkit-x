import { AckPolicy, Consumer, JsMsg, RetentionPolicy, StorageType } from 'nats';
import {
  catchError,
  defer,
  EMPTY,
  from,
  map,
  mergeMap,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { JetstreamStrategy } from './jetstream.strategy';
import { JetStreamContext } from '../jetstream.context';

/**
 * Consumer configuration interface
 */
interface ConsumerConfig {
  stream: string;
  options: {
    durable_name: string;
    deliver_group?: string;
    filter_subject: string;
    ack_policy: AckPolicy;
  };
}

const JETSTREAM_HEADERS = {
  REPLY_TO: 'Nats-Reply-To',
} as const;

/**
 * JetStream Push Strategy Implementation
 *
 * Implements a push-based consumer strategy for NATS JetStream that automatically
 * processes messages and events as they arrive. This strategy creates durable
 * consumers that persist across service restarts and ensures message delivery
 * guarantees through explicit acknowledgments.
 *
 * Features:
 * - Automatic stream creation and management
 * - Separate handling for events (fire-and-forget) and commands (request-response)
 * - Durable consumer setup with delivery groups for load balancing
 * - Built-in error handling and message acknowledgment
 * - Automatic JSON codec for message serialization/deserialization
 *
 * @example
 * ```typescript
 * const strategy = new JetstreamPushStrategy(options);
 * app.connectMicroservice(strategy);
 * ```
 */
export class JetstreamPushStrategy extends JetstreamStrategy {
  /**
   * Sets up the JetStream stream configuration
   *
   * Creates or updates a JetStream stream with subjects based on registered
   * message patterns. The stream name follows the convention:
   * `{SERVICE_NAME}_STREAM` (uppercased).
   *
   * Subject patterns:
   * - Events: `{service}.event.>`
   * - Commands: `{service}.cmd.>`
   *
   * @returns Observable that completes when stream is ready
   */
  protected override setupStream(): Observable<void> {
    const streamName = this.buildStreamName();
    const subjects = this.buildStreamSubjects();

    return this.getJetStreamManager().pipe(
      switchMap((jsm) => this.createOrUpdateStream(jsm, streamName, subjects)),
      tap(() =>
        this.logger.log(`Stream ${streamName} configured with subjects: ${subjects.join(', ')}`),
      ),
      map(() => void 0),
    );
  }

  /**
   * Sets up event handlers for fire-and-forget messaging
   *
   * Creates a durable consumer for event patterns without delivery groups,
   * allowing multiple instances to process the same events independently.
   *
   * @returns Observable that handles event consumption
   */
  protected override setupEventHandlers(): Observable<void> {
    const { events } = this.getRegisteredPatterns();

    if (events.length === 0) {
      this.logger.log('No event patterns registered, skipping event consumer');
      return of(void 0);
    }

    const config = this.buildEventConsumerConfig();

    return this.createConsumer(config).pipe(
      tap(() => this.logger.log(`Event consumer ready for patterns: ${events.join(', ')}`)),
      switchMap((consumer) => this.consumeMessages(consumer, false)),
    );
  }

  /**
   * Sets up message handlers for request-response messaging
   *
   * Creates a durable consumer with delivery groups for command patterns,
   * ensuring only one instance processes each command (load balancing).
   *
   * @returns Observable that handles message consumption
   */
  protected override setupMessageHandlers(): Observable<void> {
    const { messages } = this.getRegisteredPatterns();

    if (messages.length === 0) {
      this.logger.log('No message patterns registered, skipping message consumer');
      return of(void 0);
    }

    const config = this.buildMessageConsumerConfig();

    return this.createConsumer(config).pipe(
      tap(() => this.logger.log(`Message consumer ready for patterns: ${messages.join(', ')}`)),
      switchMap((consumer) => this.consumeMessages(consumer, true)),
    );
  }

  /**
   * Creates a JetStream consumer with the specified configuration
   *
   * @param config Consumer configuration object
   * @returns Observable that emits the created consumer
   */
  private createConsumer(config: ConsumerConfig): Observable<Consumer> {
    return this.getJetStreamManager().pipe(
      switchMap((jsm) => from(jsm.consumers.add(config.stream, config.options))),
      switchMap(() =>
        from(
          this.connectionReference!.jetstream().consumers.get(
            config.stream,
            config.options.durable_name!,
          ),
        ),
      ),
    );
  }

  /**
   * Main message consumption loop
   *
   * Processes messages from the consumer, routing them to appropriate handlers
   * based on whether they are events or RPC commands.
   *
   * @param consumer The JetStream consumer
   * @param isRpc Whether this consumer handles RPC messages
   * @returns Observable that processes messages continuously
   */
  private consumeMessages(consumer: Consumer, isRpc: boolean): Observable<void> {
    const handlerType = isRpc ? 'RPC' : 'Event';
    this.logger.log(`Starting ${handlerType} message consumption`);

    return from(consumer.consume()).pipe(
      switchMap((messageIterator) => from(messageIterator)),
      mergeMap((message) => this.processMessage(message, isRpc)),
      catchError((error) => {
        this.logger.error(`${handlerType} consumer error: ${error.message}`);
        return EMPTY;
      }),
      map(() => void 0),
    );
  }

  /**
   * Processes a single message
   *
   * @param message The JetStream message
   * @param isRpc Whether this is an RPC message
   * @returns Observable that completes when message is processed
   */
  private processMessage(message: JsMsg, isRpc: boolean): Observable<void> {
    return defer(() => {
      const handler = this.getHandlerByPattern(message.subject);

      if (!handler) {
        this.logger.warn(`No handler found for subject: ${message.subject}`);
        message.ack();
        return of(void 0);
      }

      return isRpc
        ? this.handleRpcMessage(message, handler)
        : this.handleEventMessage(message, handler);
    });
  }

  /**
   * Handles event messages (fire-and-forget)
   *
   * @param message The JetStream message
   * @param handler The message handler function
   * @returns Observable that completes when event is processed
   */
  private handleEventMessage(message: JsMsg, handler: any): Observable<void> {
    return defer(() => {
      const data = this.decodeMessageData(message);
      const ctx = new JetStreamContext([message]);

      try {
        const result = handler(data, ctx);

        return this.handleAsyncResult(result).pipe(
          tap(() => message.ack()),
          catchError((error) => {
            this.logger.error(`Event handler error for ${message.subject}: ${error.message}`);
            message.nak();
            return of(void 0);
          }),
        );
      } catch (error) {
        this.logger.error(
          `Event handler error for ${message.subject}: ${(error as Error).message}`,
        );
        message.nak();
        return of(void 0);
      }
    });
  }

  /**
   * Handles RPC messages (request-response)
   *
   * @param message The JetStream message
   * @param handler The message handler function
   * @returns Observable that completes when RPC is processed
   */
  private handleRpcMessage(message: JsMsg, handler: any): Observable<void> {
    console.log('🚀 BEFORE defer - Handling RPC message:', {
      subject: message.subject,
      handlerType: typeof handler,
    });

    return defer(() => {
      const data = this.decodeMessageData(message);
      const ctx = new JetStreamContext([message]);

      const replyTo = message.headers?.get(JETSTREAM_HEADERS.REPLY_TO);

      try {
        const result = handler(data, ctx);

        return this.handleAsyncResult(result).pipe(
          tap((response) => {
            if (replyTo) {
              this.publishResponse(replyTo, response);
            }
            message.ack();
          }),
          catchError((error) => {
            this.logger.error(`RPC handler error for ${message.subject}: ${error.message}`);
            if (replyTo) {
              this.publishErrorResponse(replyTo, error);
            }
            message.nak();
            return of(void 0);
          }),
        );
      } catch (error) {
        console.error('❌ Handler exception:', error);
        this.logger.error(`RPC handler error for ${message.subject}: ${(error as Error).message}`);
        if (replyTo) {
          this.publishErrorResponse(replyTo, error);
        }
        message.nak();
        return of(void 0);
      }
    });
  }

  /**
   * Decodes message data using the configured codec
   *
   * @param message The JetStream message
   * @returns Decoded message data
   */
  private decodeMessageData(message: JsMsg): any {
    try {
      return this.codec.decode(message.data);
    } catch (error) {
      this.logger.error(`Failed to decode message data: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Handles async results from message handlers
   * NestJS always wraps results in Promise, so we only need to handle that case
   */
  private handleAsyncResult(result: any): Observable<any> {
    return from(result).pipe(
      switchMap((resolvedValue: any) => {
        if (resolvedValue && typeof resolvedValue.subscribe === 'function') {
          return resolvedValue as Observable<any>;
        }
        return of(resolvedValue);
      }),
    );
  }

  /**
   * Publishes a successful response to the reply subject
   *
   * @param replyTo The reply subject
   * @param response The response data
   */
  private publishResponse(replyTo: string, response: any): void {
    try {
      this.connectionReference!.publish(replyTo, this.codec.encode(response));
    } catch (error) {
      this.logger.error(`Failed to serialize response: ${(error as Error).message}`);
      this.publishErrorResponse(replyTo, new Error('Response serialization failed'));
    }
  }

  /**
   * Publishes an error response to the reply subject
   *
   * @param replyTo The reply subject
   * @param error The error to send
   */
  private publishErrorResponse(replyTo: string, error: any): void {
    const errorResponse = {
      error: error instanceof Error ? error.message : String(error),
    };
    this.connectionReference!.publish(replyTo, this.codec.encode(errorResponse));
  }

  /**
   * Builds the stream name based on service name
   *
   * @returns The stream name
   */
  private buildStreamName(): string {
    return `${this.options.serviceName.toUpperCase()}_STREAM`;
  }

  /**
   * Builds stream subjects based on registered patterns
   *
   * @returns Array of subject patterns
   */
  private buildStreamSubjects(): string[] {
    const { events, messages } = this.getRegisteredPatterns();
    const subjects: string[] = [];

    if (events.length > 0) {
      subjects.push(`${this.options.serviceName}.event.>`);
    }
    if (messages.length > 0) {
      subjects.push(`${this.options.serviceName}.cmd.>`);
    }

    return subjects.length > 0 ? subjects : [`${this.options.serviceName}.>`];
  }

  /**
   * Builds event consumer configuration
   *
   * @returns Consumer configuration for events
   */
  private buildEventConsumerConfig(): ConsumerConfig {
    return {
      stream: this.buildStreamName(),
      options: {
        durable_name: `${this.options.serviceName}_EVENT`,
        filter_subject: `${this.options.serviceName}.event.>`,
        ack_policy: AckPolicy.Explicit,
      },
    };
  }

  /**
   * Builds message consumer configuration
   *
   * @returns Consumer configuration for messages
   */
  private buildMessageConsumerConfig(): ConsumerConfig {
    return {
      stream: this.buildStreamName(),
      options: {
        durable_name: `${this.options.serviceName}_MESSAGE`,
        deliver_group: `${this.options.serviceName}_MESSAGE_GROUP`,
        filter_subject: `${this.options.serviceName}.cmd.>`,
        ack_policy: AckPolicy.Explicit,
      },
    };
  }

  /**
   * Creates or updates a JetStream stream
   *
   * @param jsm JetStream manager
   * @param streamName Stream name
   * @param subjects Stream subjects
   * @returns Observable that completes when stream is ready
   */
  private createOrUpdateStream(jsm: any, streamName: string, subjects: string[]): Observable<void> {
    return defer(() => from(jsm.streams.info(streamName))).pipe(
      switchMap(() => from(jsm.streams.update(streamName, { subjects }))),
      catchError(() =>
        from(
          jsm.streams.add({
            name: streamName,
            subjects,
            storage: StorageType.File,
            retention: RetentionPolicy.Interest,
          }),
        ),
      ),
      map(() => void 0),
    );
  }
}
