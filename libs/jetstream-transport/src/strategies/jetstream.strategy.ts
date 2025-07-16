import { Server, TransportId } from '@nestjs/microservices';
import { CustomTransportStrategy } from '@nestjs/microservices/interfaces/custom-transport-strategy.interface';
import { Codec, connect as natsConnect, JetStreamManager, JSONCodec, NatsConnection } from 'nats';
import {
  catchError,
  defer,
  EMPTY,
  finalize,
  from,
  map,
  Observable,
  of,
  shareReplay,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';

import { IJetstreamTransportOptions } from '../types/jetstream-transport.options';
import { AnyCallback, AnyCallbackResult } from '../types/callback.types';
import { IJetstreamEventsMap } from '../types/events-map.interface';
import { JetstreamEventBus } from '../jetstream.event-bus';
import { JetstreamEvent } from '@nestkit-x/jetstream-transport';

/**
 * Abstract base class for implementing NATS JetStream transport strategies in NestJS microservices.
 * Provides core functionality for managing NATS connections and JetStream interactions.
 *
 * @implements {CustomTransportStrategy}
 * @extends {Server}
 */
export abstract class JetstreamStrategy
  extends Server<IJetstreamEventsMap>
  implements CustomTransportStrategy
{
  public override readonly transportId: TransportId = Symbol('NATS_JETSTREAM_TRANSPORT');

  protected readonly eventBus = new JetstreamEventBus();
  protected readonly codec: Codec<JSON> = JSONCodec();

  private connectionReference: NatsConnection | null = null;
  private jetStreamManager$: Observable<JetStreamManager> | null = null;
  private natsConnection$: Observable<NatsConnection> | null = null;

  public constructor(protected readonly options: IJetstreamTransportOptions) {
    super();
  }

  /**
   * Establishes and caches a connection to the NATS server.
   * Uses connection options provided during initialization.
   *
   * @returns {Observable<NatsConnection>} Observable that emits the NATS connection
   * @protected
   */
  protected getNatsConnection(): Observable<NatsConnection> {
    if (this.natsConnection$) return this.natsConnection$;

    this.eventBus.emit(JetstreamEvent.Connecting);

    const natsConnector = defer(() => from(natsConnect(this.options.connectionOptions)));

    this.natsConnection$ = natsConnector.pipe(
      tap((connection) => {
        this.connectionReference = connection;
        this.eventBus.emit(JetstreamEvent.Connected, connection);
      }),
      catchError((error) => {
        this.eventBus.emit(JetstreamEvent.Error, error);

        throw error;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    return this.natsConnection$;
  }

  /**
   * Creates and caches a JetStream manager instance from the NATS connection.
   * Uses JetStream options provided during initialization.
   *
   * @returns {Observable<JetStreamManager>} Observable that emits the JetStream manager
   * @protected
   */
  protected getJetStreamManager(): Observable<JetStreamManager> {
    if (this.jetStreamManager$) {
      return this.jetStreamManager$;
    }

    this.jetStreamManager$ = this.getNatsConnection().pipe(
      switchMap((connection) =>
        defer(() => from(connection.jetstreamManager(this.options.jetstreamOptions))),
      ),
      tap(() => {
        this.eventBus.emit(JetstreamEvent.JetStreamAttached);
      }),
      catchError((error) => {
        this.eventBus.emit(JetstreamEvent.Error, error);

        throw error;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    return this.jetStreamManager$;
  }

  /**
   * Helper method that provides access to both NATS connection and JetStream manager.
   *
   * @returns {Observable<{connection: NatsConnection; jetStreamManager: JetStreamManager}>} Observable that emits both connection instances
   * @protected
   */
  protected connect(): Observable<{
    connection: NatsConnection;
    jetStreamManager: JetStreamManager;
  }> {
    return this.getNatsConnection().pipe(
      switchMap((connection) =>
        this.getJetStreamManager().pipe(
          map((jetStreamManager) => ({ connection, jetStreamManager })),
        ),
      ),
      catchError((error) => {
        this.eventBus.emit(JetstreamEvent.Error, error);

        throw error;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  /**
   * Gracefully closes the NATS connection.
   * Drains the connection before closing to ensure message delivery.
   *
   * @returns {Observable<void>} Observable that completes when connection is closed
   */
  public override close(): Observable<void> {
    if (!this.natsConnection$) return EMPTY;

    const drainAndClose = (nc: NatsConnection) =>
      defer(() => from(nc.drain())).pipe(
        switchMap(() => from(nc.close())),
        tap(() => {
          this.eventBus.emit(JetstreamEvent.Disconnected);
        }),
      );

    const handleError = (error: any) => {
      this.eventBus.emit(JetstreamEvent.Error, error);

      return EMPTY;
    };

    const cleanup = () => {
      this.natsConnection$ = null;
      this.jetStreamManager$ = null;
      this.connectionReference = null;

      // Destroy event bus
      this.eventBus.destroy();
    };

    return this.natsConnection$.pipe(
      switchMap((nc) => (nc.isClosed() ? EMPTY : drainAndClose(nc))),
      catchError(handleError),
      finalize(cleanup),
      take(1),
    );
  }

  /**
   * Initializes the transport strategy and starts listening for messages.
   * Follows these steps:
   * 1. Establishes NATS and JetStream connections
   * 2. Sets up stream configuration
   * 3. Sets up event handlers
   * 4. Sets up message handlers
   * 5. Signals transport readiness via callback
   *
   * @param {AnyCallback} cb Callback to signal transport readiness
   * @returns {AnyCallbackResult} Void or Promise/Observable of void
   */
  public override listen(cb: AnyCallback): AnyCallbackResult {
    const flow$ = this.connect().pipe(
      take(1),
      switchMap(() => this.setupStream()),
      switchMap(() => this.setupEventHandlers()),
      switchMap(() => this.setupMessageHandlers()),

      switchMap(() => {
        const result = cb();

        return result ? from(result) : of(void 0);
      }),

      catchError((err) => {
        this.eventBus.emit(JetstreamEvent.Error, err);

        return EMPTY;
      }),

      shareReplay({ bufferSize: 1, refCount: true }),
    );

    flow$.subscribe();
    return flow$;
  }

  public override on<
    EventKey extends keyof IJetstreamEventsMap,
    EventCallback extends IJetstreamEventsMap[EventKey],
  >(event: EventKey, callback: EventCallback): Subscription {
    const jetstreamEvent = event as JetstreamEvent;

    return this.eventBus.on(jetstreamEvent).subscribe((args) => {
      callback(...args);
    });
  }

  public override unwrap<T = NatsConnection | null>(): T {
    return this.connectionReference as T;
  }

  /**
   * Abstract method to set up JetStream stream configuration.
   * Implemented by concrete strategy classes.
   * @returns {Observable<void>} Observable that completes when stream is configured
   * @protected
   */
  protected abstract setupStream(): Observable<void>;

  /**
   * Abstract method to set up event handlers.
   * Implemented by concrete strategy classes.
   * @returns {Observable<void>} Observable that completes when handlers are set up
   * @protected
   */
  protected abstract setupEventHandlers(): Observable<void>;

  /**
   * Abstract method to set up message handlers.
   * Implemented by concrete strategy classes.
   * @returns {Observable<void>} Observable that completes when handlers are set up
   * @protected
   */
  protected abstract setupMessageHandlers(): Observable<void>;
}
