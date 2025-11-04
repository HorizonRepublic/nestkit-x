import { CustomTransportStrategy, Server, TransportId } from '@nestjs/microservices';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { StreamProvider } from './providers/stream.provider';
import { ConnectionProvider } from '../common/connection.provider';
import { Events, NatsConnection } from 'nats';
import { filter, startWith, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { INatsEventsMap } from './types/nats.events-map';
import { ConsumerProvider } from './providers/consumer.provider';
import { JetStreamKind } from '../enum';

@Injectable()
export class JetstreamStrategy
  extends Server<INatsEventsMap>
  implements CustomTransportStrategy, OnModuleInit
{
  public override readonly transportId: TransportId = Symbol('jetstream-transport');

  private readonly destroy$ = new Subject<void>();
  private readonly reconnect$ = new Subject<void>();

  public constructor(
    private readonly connectionProvider: ConnectionProvider,
    private readonly streamProvider: StreamProvider,
    private readonly consumerProvider: ConsumerProvider,
  ) {
    super();
  }

  public onModuleInit(): void {
    this.on(Events.Reconnect, () => {
      this.reconnect$.next();
    });
  }

  public listen(done: { (): void }): void {
    this.reconnect$
      .pipe(
        startWith(void 0),
        switchMap(() => this.streamProvider.create()),
        switchMap(() => this.consumerProvider.create()),
        tap(done),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  public close(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.connectionProvider.gracefulShutdown().subscribe();
  }

  public on<EventKey extends keyof INatsEventsMap>(
    event: EventKey,
    callback: INatsEventsMap[EventKey],
  ): void {
    this.connectionProvider.status
      .pipe(
        filter((status) => status.type == event),
        tap((status) => {
          const args = [status.data];

          (callback as (...args: unknown[]) => void)(...args);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  public override unwrap<T = NatsConnection>(): T {
    return this.connectionProvider.unwrap as T;
  }
}
