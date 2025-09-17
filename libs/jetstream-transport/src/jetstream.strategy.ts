import { Codec, JSONCodec, NatsConnection } from 'nats';
import {
  CustomTransportStrategy,
  MessageHandler,
  Server,
  TransportId,
} from '@nestjs/microservices';
import {
  catchError,
  EMPTY,
  filter,
  finalize,
  map,
  Observable,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import { JsEventBus } from './registries/js-event.bus';
import { IJetstreamTransportOptions, JETSTREAM_TRANSPORT, JetstreamEvent } from './index';
import { Logger } from '@nestjs/common';
import { JsConnectionManager } from './managers/js.connection-manager';
import { JetStreamStreamManager } from './managers/js.stream-manager';
import { JsConsumerManager } from './managers/js.consumer-manager';
import { JsMsgManager } from './managers/js.msg-manager';
import { JsPatternRegistry } from './registries/js.pattern-registry';
import { JsConsumerSupervisor } from './managers/js.consumer-supervisor';

/**
 * NestJS custom transport strategy for NATS JetStream messaging.
 *
 * This strategy provides a complete JetStream implementation that handles:
 * - Connection management with automatic reconnection
 * - Stream and consumer lifecycle management
 * - Message routing and handler resolution
 * - Error handling and event emission
 * - Graceful shutdown with resource cleanup.
 *
 * The strategy automatically creates Event and Command streams based on
 * registered message handlers and manages pull-based consumers for reliable
 * message delivery with acknowledgment support.
 */
export class JetstreamStrategy
  extends Server<Record<string, (...args: unknown[]) => unknown>>
  implements CustomTransportStrategy
{
  public override readonly transportId: TransportId = JETSTREAM_TRANSPORT;
  protected override logger = new Logger(JetstreamStrategy.name);

  // Core message encoding/decoding using NATS JSON codec
  private readonly codec: Codec<unknown> = JSONCodec();

  // Manager instances for different aspects of JetStream functionality
  private readonly connectionManager: JsConnectionManager;
  private readonly eventBus: JsEventBus;
  private readonly streamManager: JetStreamStreamManager;
  private readonly consumerManager: JsConsumerManager;
  private readonly msgManager: JsMsgManager;
  private readonly patterns: JsPatternRegistry;
  private readonly supervisor: JsConsumerSupervisor;

  // Active subscription for the main message processing loop
  private sub?: Subscription;
  // Ensure done() is called only once across reconnects
  private readySignalled = false;

  /**
   * Initializes the JetStream strategy with all required managers and dependencies.
   *
   * The constructor creates a complete ecosystem of managers that work together:
   * - Connection manager handles NATS connection lifecycle
   * - Stream manager ensures JetStream streams exist
   * - Consumer manager creates and manages durable consumers
   * - Message manager processes incoming messages and routes them to handlers
   * - Pattern registry maps message subjects to NestJS message handlers
   * - Consumer supervisor orchestrates pull-based message consumption.
   *
   * @param options JetStream transport configuration including connection settings.
   */
  public constructor(protected readonly options: IJetstreamTransportOptions) {
    super();

    // Initialize event bus for internal communication between managers
    this.eventBus = new JsEventBus();

    // Create connection manager with event bus integration
    this.connectionManager = new JsConnectionManager(this.options, this.eventBus);

    // Initialize stream manager for JetStream stream lifecycle
    this.streamManager = new JetStreamStreamManager(
      this.connectionManager.getJetStreamManager(),
      this.options,
      this.logger,
    );

    // Initialize consumer manager for durable consumer creation
    this.consumerManager = new JsConsumerManager(
      this.connectionManager.getJetStreamManager(),
      this.options,
      this.logger,
    );

    // Create pattern registry to map subjects to handlers
    this.patterns = new JsPatternRegistry(this.options.serviceName, this.messageHandlers);

    // Create message manager with handler resolution callback
    const handlerResolver = (subject: string): MessageHandler | null =>
      this.patterns.getHandler(subject);

    this.msgManager = new JsMsgManager(
      this.connectionManager.getNatsConnection(),
      this.codec,
      this.eventBus,
      handlerResolver,
    );

    // Initialize consumer supervisor to orchestrate message consumption
    this.supervisor = new JsConsumerSupervisor(
      this.consumerManager,
      this.streamManager,
      this.connectionManager.getNatsConnection(),
      this.msgManager,
    );
  }

  /**
   * Retrieves a message handler for a specific subject pattern.
   *
   * This method is called by NestJS to resolve handlers during message processing.
   * It delegates to the pattern registry which normalizes NATS subjects to
   * handler patterns registered via @MessagePattern and @EventPattern decorators.
   *
   * @param subject NATS subject to find handler for.
   * @returns Message handler function or null if no handler found.
   */
  public override getHandlerByPattern(subject: string): MessageHandler | null {
    return this.patterns.getHandler(subject);
  }

  /**
   * Gracefully shuts down the JetStream strategy and all associated resources.
   *
   * The shutdown process ensures:
   * 1. Active message processing subscription is cancelled
   * 2. NATS connection is properly drained and closed
   * 3. Event bus is destroyed to prevent memory leaks
   * 4. All background processes are terminated.
   *
   * @returns Observable that completes when shutdown is finished.
   */
  public close(): Observable<void> {
    // Cancel active subscription to stop new message processing
    this.sub?.unsubscribe();

    // Close connection manager and clean up event bus
    return this.connectionManager.close().pipe(
      finalize(() => {
        this.eventBus.destroy();
      }),
    );
  }

  /**
   * Starts the JetStream message processing pipeline.
   *
   * This method orchestrates an event-driven startup & recovery sequence:
   * - On Connected/Reconnected: ensures streams and (re)starts consumers
   * - On Disconnected: stops current consumer flows
   * - Calls done() only once on the first successful startup
   *
   * @param done Callback to signal NestJS that transport is ready.
   */
  public listen(done: () => void): void {
    // Guard against multiple listen calls
    if (this.sub && !this.sub.closed) return;

    const streamSetup = (): Observable<void> => this.streamManager.ensureAll();

    const consumerSetup = (): Observable<void> => {
      // Cache pattern information to avoid repeated calls
      const patternCache = this.patterns.list();

      // Determine which stream types need consumers based on registered handlers
      const hasEventHandlers = patternCache.events.length > 0;
      const hasMessageHandlers = patternCache.messages.length > 0;

      return this.supervisor.run(hasEventHandlers, hasMessageHandlers);
    };

    // Connection state stream: true on (Re)Connected, false on Disconnected
    const connectionState$ = this.eventBus.status.pipe(
      filter(
        (e) =>
          e === JetstreamEvent.Connected ||
          e === JetstreamEvent.Reconnected ||
          e === JetstreamEvent.Disconnected,
      ),
      map((e) => e === JetstreamEvent.Connected || e === JetstreamEvent.Reconnected),
    );

    const runPipeline = (): Observable<void> =>
      streamSetup().pipe(
        tap(() => {
          if (!this.readySignalled) {
            done();
            this.readySignalled = true;
          }
        }),
        switchMap(consumerSetup),
      );

    const handleError = (err: unknown): Observable<never> => {
      this.eventBus.emit(JetstreamEvent.Error, err);
      // Keep listening for future reconnects
      return EMPTY;
    };

    // Start/stop consumers based on connection state
    this.sub = connectionState$
      .pipe(
        switchMap((connected) => (connected ? runPipeline().pipe(catchError(handleError)) : EMPTY)),
      )
      .subscribe();
  }

  /**
   * Subscribes to JetStream events emitted by the internal event bus.
   *
   * This method follows the base Server class signature while providing
   * type-safe access to JetStream-specific events. It bridges the gap
   * between the internal event system and external event handlers.
   *
   * @param event Event type to listen for.
   * @param callback Function to call when event is emitted.
   * @returns Subscription that can be used to unsubscribe.
   */
  public override on<EventKey extends string = string>(
    event: EventKey,
    callback: (...args: unknown[]) => unknown,
  ): Subscription {
    return this.eventBus.on(event as JetstreamEvent, callback as (...args: unknown[]) => void);
  }

  /**
   * Provides direct access to the underlying NATS connection.
   *
   * This method allows advanced users to access the raw NATS connection
   * for operations not covered by the JetStream strategy. Use with caution
   * as direct connection manipulation can interfere with the strategy's
   * internal state management.
   *
   * @returns Raw NATS connection instance or null if not connected.
   */
  public unwrap<T = NatsConnection | null>(): T {
    return this.connectionManager.getRef() as T;
  }

  /**
   * Provides access to the current JetStream connection status.
   *
   * Returns an observable that emits status updates as the connection
   * state changes. This can be used to monitor connection health and
   * react to connection events in external code.
   *
   * @returns Observable that emits current JetStream status.
   */
  public override get status(): Observable<JetstreamEvent> {
    return this.eventBus.status;
  }
}
