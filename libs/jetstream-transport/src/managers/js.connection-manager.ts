import {
  catchError,
  defer,
  EMPTY,
  finalize,
  from,
  ignoreElements,
  map,
  merge,
  Observable,
  of,
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

export class JsConnectionManager {
  protected connectionReference: NatsConnection | null = null;
  protected readonly jetStreamManager$: Observable<JetStreamManager>;
  protected readonly natsConnection$: Observable<NatsConnection>;

  public constructor(
    private readonly options: IJetstreamTransportOptions,
    private readonly eventBus: JsEventBus,
  ) {
    this.natsConnection$ = this.createNatsConnection();
    this.jetStreamManager$ = this.createJetStreamConnection();
  }

  public getRef(): NatsConnection | null {
    return this.connectionReference;
  }

  public getNatsConnection(): Observable<NatsConnection> {
    return this.natsConnection$;
  }

  public getJetStreamManager(): Observable<JetStreamManager> {
    return this.jetStreamManager$;
  }

  public close(): Observable<void> {
    return this.natsConnection$.pipe(
      take(1),
      switchMap((nc) =>
        nc.isClosed()
          ? EMPTY
          : defer(() => from(nc.drain())).pipe(
              switchMap(() => from(nc.closed())),
              catchError((e) => {
                // drain failed, try to close gracefully
                this.eventBus.emit(JetstreamEvent.Error, e);
                return from(nc.close()).pipe(
                  catchError(() => EMPTY),
                  map(() => void 0), // Ensure void return type
                );
              }),
              map(() => void 0), // Ensure void return type
            ),
      ),
      tap(() => {
        this.eventBus.emit(JetstreamEvent.Disconnected);
      }),
      finalize(() => {
        this.connectionReference = null;
      }),
      map(() => void 0), // Ensure the final return type is void
    );
  }

  private createNatsConnection(): Observable<NatsConnection> {
    const opts: ConnectionOptions = {
      ...this.options.connectionOptions,
      name: this.options.connectionOptions?.name ?? this.options.serviceName,
    };

    // ① Observable, що робить connect()
    const connect$ = defer(() => {
      this.eventBus.emit(JetstreamEvent.Connecting);
      return from(connect(opts));
    }).pipe(
      tap((conn) => {
        this.connectionReference = conn;
        this.eventBus.emit(JetstreamEvent.Connected, conn);
      }),
      // помилки при коннекті
      catchError((err) => {
        this.eventBus.emit(JetstreamEvent.Error, err);
        throw err;
      }),
    );

    const $conn = connect$.pipe(
      // ② коли конектнулися ─ запускаємо стрім статусів
      switchMap((conn) => {
        /** Observable<Status> з async‑iterator’а */
        const status$ = from(conn.status()).pipe(
          tap((s) => {
            if (s.type === Events.Disconnect) this.eventBus.emit(JetstreamEvent.Disconnected);
            if (s.type === Events.Reconnect) this.eventBus.emit(JetstreamEvent.Reconnected, conn);
            if (s.type === Events.Error) this.eventBus.emit(JetstreamEvent.Error, s.data);
          }),
          ignoreElements(), // side‑effects only, не пропускаємо далі
          takeUntil(from(conn.closed())), // завершуємся, коли з’єднання закрито
        );

        /* merge поверне сам connection (для тих, хто підписався на createNatsConnection)
         і паралельно почне слухати status$ (яке нічого не емiтить назовні) */
        return merge(of(conn), status$);
      }),

      /* кешуємо перший успішний conn; після close() Observable завершиться,
       тож наступний підписник ініціює reconnection.                       */
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    $conn.subscribe();

    return connect$;
  }

  private createJetStreamConnection(): Observable<JetStreamManager> {
    return this.natsConnection$.pipe(
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

      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }
}
