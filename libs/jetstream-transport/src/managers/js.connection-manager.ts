import {
  catchError,
  defer,
  EMPTY, filter,
  finalize,
  from,
  ignoreElements,
  map,
  Observable,
  shareReplay,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { connect, JetStreamManager, NatsConnection } from 'nats';
import { JetstreamEvent } from '../const/conts';
import { ConnectionOptions } from 'nats/lib/src/nats-base-client';
import { IJetstreamTransportOptions } from '../types/jetstream-transport.options';
import { JsEventBus } from '../registries/js-event.bus';
import { Events } from 'nats/lib/nats-base-client/core';

/**
 * Manages NATS connection lifecycle and JetStream manager initialization.
 *
 * Establishes NATS connection, monitors connection status events, and provides
 * JetStream manager instance. Handles graceful connection closure with proper
 * cleanup and event emission throughout the connection lifecycle.
 */
export class JsConnectionManager {
  protected connectionReference: NatsConnection | null = null;
  protected readonly jetStreamManager$: Observable<JetStreamManager>;
  protected readonly natsConnection$: Observable<NatsConnection>;

  private hasEmittedConnected = false;

  /**
   * Initializes connection manager with configuration and event bus.
   * Immediately starts connection and JetStream manager creation.
   *
   * @param options - NATS connection and JetStream configuration
   * @param eventBus - Event bus for connection lifecycle events
   */
  public constructor(
    private readonly options: IJetstreamTransportOptions,
    private readonly eventBus: JsEventBus,
  ) {
    this.natsConnection$ = this.createNatsConnection();
    this.jetStreamManager$ = this.createJetStreamConnection();
  }

  /**
   * Returns raw NATS connection reference for direct access.
   *
   * @returns Current connection instance or null if not connected
   */
  public getRef(): NatsConnection | null {
    return this.connectionReference;
  }

  /**
   * Returns observable that emits NATS connection when available.
   *
   * @returns Observable of NATS connection
   */
  public getNatsConnection(): Observable<NatsConnection> {
    return this.natsConnection$;
  }

  /**
   * Returns observable that emits JetStream manager when available.
   *
   * @returns Observable of JetStream manager
   */
  public getJetStreamManager(): Observable<JetStreamManager> {
    return this.jetStreamManager$;
  }

  /**
   * Gracefully closes NATS connection with proper cleanup.
   *
   * Drains pending messages before closing connection. Falls back to
   * direct close if drain fails. Emits disconnection event and clears
   * connection reference.
   *
   * @returns Observable that completes when connection is closed
   */
  public close(): Observable<void> {
    return this.natsConnection$.pipe(
      take(1),
      switchMap((nc) => this.drainConnection(nc)),
      tap(() => this.eventBus.emit(JetstreamEvent.Disconnected)),
      finalize(() => {
        this.connectionReference = null;
        this.hasEmittedConnected = false;
      }),
      map(() => void 0),
    );
  }

  /**
   * Drains connection gracefully or falls back to direct close.
   * @param nc - NATS connection to drain
   * @returns Observable that completes when connection is closed
   */
  private drainConnection(nc: NatsConnection): Observable<void> {
    if (nc.isClosed()) return EMPTY;

    return defer(() => from(nc.drain())).pipe(
      switchMap(() => from(nc.closed())),
      catchError((e) => {
        this.eventBus.emit(JetstreamEvent.Error, e);
        return from(nc.close()).pipe(catchError(() => EMPTY));
      }),
      map(() => void 0),
    );
  }

  /**
   * Creates NATS connection with status monitoring.
   * Ensures Connected event is emitted only once per connection lifecycle.
   *
   * @returns Observable that emits connection when established
   */
  private createNatsConnection(): Observable<NatsConnection> {
    const opts: ConnectionOptions = {
      ...this.options.connectionOptions,
      name: this.options.connectionOptions?.name ?? this.options.serviceName,
    };

    const connect$ = defer(() => {
      this.eventBus.emit(JetstreamEvent.Connecting);
      return from(connect(opts));
    }).pipe(
      tap((conn) => {
        this.connectionReference = conn;
        // Emit Connected event only once per connection
        if (!this.hasEmittedConnected) {
          this.hasEmittedConnected = true;
          this.eventBus.emit(JetstreamEvent.Connected, conn);
        }
      }),
      catchError((err) => {
        this.eventBus.emit(JetstreamEvent.Error, err);
        throw err;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    // Start background status monitoring
    this.startStatusMonitoring(connect$);

    return connect$;
  }

  /**
   * Starts background status monitoring for connection events.
   * Monitors reconnection and disconnection events without duplicating Connected events.
   *
   * @param connect$ - Connection observable to monitor
   */
  private startStatusMonitoring(connect$: Observable<NatsConnection>): void {
    connect$
      .pipe(
        switchMap((conn) => this.monitorConnectionStatus(conn)),
        takeUntil(
          this.eventBus.status.pipe(
            // Stop monitoring when permanently disconnected
            filter((status) => status === JetstreamEvent.Disconnected),
            take(1),
          ),
        ),
      )
      .subscribe();
  }

  /**
   * Monitors connection status events and emits appropriate events.
   * Handles reconnection and error events without duplicating Connected events.
   *
   * @param conn - NATS connection to monitor
   * @returns Observable that monitors status until connection closes
   */
  private monitorConnectionStatus(conn: NatsConnection): Observable<never> {
    return from(conn.status()).pipe(
      tap((status) => {
        switch (status.type) {
          case Events.Disconnect:
            this.hasEmittedConnected = false;
            this.eventBus.emit(JetstreamEvent.Disconnected);
            break;
          case Events.Reconnect:
            // Only emit Connected if we haven't already for this connection
            if (!this.hasEmittedConnected) {
              this.hasEmittedConnected = true;
              this.eventBus.emit(JetstreamEvent.Connected, conn);
            }
            this.eventBus.emit(JetstreamEvent.Reconnected, conn);
            break;
          case Events.Error:
            this.eventBus.emit(JetstreamEvent.Error, status.data);
            break;
        }
      }),
      ignoreElements(),
      takeUntil(from(conn.closed())),
    );
  }

  /**
   * Creates JetStream manager from established NATS connection.
   *
   * Waits for NATS connection then initializes JetStream manager with
   * provided options. Emits attachment event when ready.
   *
   * @returns Observable that emits JetStream manager when ready
   */
  private createJetStreamConnection(): Observable<JetStreamManager> {
    return this.natsConnection$.pipe(
      switchMap((connection) =>
        defer(() => from(connection.jetstreamManager(this.options.jetstreamOptions))),
      ),
      tap(() => this.eventBus.emit(JetstreamEvent.JetStreamAttached)),
      catchError((error) => {
        this.eventBus.emit(JetstreamEvent.Error, error);
        throw error;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }
}
