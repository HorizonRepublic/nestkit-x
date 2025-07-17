import {
  catchError,
  defer,
  EMPTY,
  finalize,
  from,
  Observable,
  shareReplay,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { connect, JetStreamManager, NatsConnection } from 'nats';
import { JetstreamEvent } from '../const/conts';
import { ConnectionOptions } from 'nats/lib/src/nats-base-client';
import { IJetstreamTransportOptions } from '../types/jetstream-transport.options';
import { JsEventBus } from '../js-event.bus';

export class JsConnectionManager {
  protected connectionReference: NatsConnection | null = null;
  protected readonly jetStreamManager$: Observable<JetStreamManager>;
  protected readonly natsConnection$: Observable<NatsConnection>;

  public constructor(
    private readonly options: IJetstreamTransportOptions,
    private readonly eventBus: JsEventBus,
  ) {
    this.natsConnection$ = this.createNatsConnection();
    this.jetStreamManager$ = this.createJetStreamManager();
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
      switchMap((nc: NatsConnection) => {
        if (nc.isClosed()) return EMPTY;

        return defer(() => from(nc.drain())).pipe(
          switchMap(() => from(nc.close())),
          tap(() => {
            this.eventBus.emit(JetstreamEvent.Disconnected);
          }),
        );
      }),

      catchError((error: any) => {
        this.eventBus.emit(JetstreamEvent.Error, error);

        return EMPTY;
      }),

      finalize(() => {
        this.connectionReference = null;
      }),

      take(1),
    );
  }

  private createNatsConnection(): Observable<NatsConnection> {
    const opts: ConnectionOptions = {
      ...this.options.connectionOptions,
      name: this.options.serviceName,
    };

    this.eventBus.emit(JetstreamEvent.Connecting);

    const natsConnector = defer(() => from(connect(opts)));

    return natsConnector.pipe(
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
  }

  private createJetStreamManager(): Observable<JetStreamManager> {
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
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}
