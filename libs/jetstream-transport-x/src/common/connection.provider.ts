import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { connect, JetStreamManager, NatsConnection, NatsError, Status } from 'nats';
import {
  catchError,
  EMPTY,
  from,
  iif,
  Observable,
  of,
  share,
  shareReplay,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { IJetstreamTransportOptions } from './types';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

@Injectable()
export class ConnectionProvider implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectionProvider.name);

  private nc$!: Observable<NatsConnection>;
  private jsm$!: Observable<JetStreamManager>;
  private status$!: Observable<Status>;
  private unwrappedConnection!: NatsConnection;

  private readonly subscription?: Subscription;

  public constructor(private readonly options: IJetstreamTransportOptions) {
    this.setupConnection();
  }

  public get status(): Observable<Status> {
    return this.status$;
  }

  public get nc(): Observable<NatsConnection> {
    return this.nc$;
  }

  public get jsm(): Observable<JetStreamManager> {
    return this.jsm$;
  }

  public get unwrap(): NatsConnection {
    return this.unwrappedConnection;
  }

  public onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  public gracefulShutdown(): Observable<void | Error | undefined> {
    return this.nc.pipe(
      take(1),
      switchMap((nc) =>
        iif(
          () => nc.isClosed(),
          of(void 0),
          from(nc.drain()).pipe(
            switchMap(() => from(nc.closed())),
            catchError(() => from(nc.close())),
            catchError(() => of(void 0)),
          ),
        ),
      ),
    );
  }

  protected setupConnection(): void {
    const name = `${this.options.name}_${this.options.serviceType}`;
    const connected$ = from(connect({ ...this.options, name }));

    this.nc$ = connected$.pipe(
      catchError((err: NatsError) => this.handleError(err)),

      tap((connection) => {
        this.unwrappedConnection = connection;
        this.logger.log(`NATS connection established: ${connection.getServer()}`);
      }),

      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.jsm$ = this.nc$.pipe(
      switchMap((c: NatsConnection) => from(c.jetstreamManager())),

      tap(() => {
        this.logger.log(`NATS JetStream manager initialized`);
      }),

      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.status$ = this.nc$.pipe(
      switchMap((c: NatsConnection) => from(c.status())),
      share(), // event bus; no replay
    );
  }

  protected handleError(err: NatsError): Observable<NatsConnection> {
    if (err.code === 'CONNECTION_REFUSED') throw new RuntimeException(err.message);

    return EMPTY;
  }
}
