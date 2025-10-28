import { CustomTransportStrategy, Server, TransportId } from '@nestjs/microservices';
import { Injectable } from '@nestjs/common';
import { StreamProvider } from './providers/stream.provider';
import { ConnectionProvider } from '../common/connection.provider';
import * as console from 'node:console';
import { NatsConnection } from 'nats';
import { filter, Subject, takeUntil, tap } from 'rxjs';
import { INatsEventsMap } from './types/nats.events-map';

@Injectable()
export class JetstreamStrategy extends Server<INatsEventsMap> implements CustomTransportStrategy {
  public override readonly transportId: TransportId = Symbol('jetstream-transport');

  private readonly destroy$ = new Subject<void>();

  public constructor(
    private readonly connectionProvider: ConnectionProvider,
    private readonly streamProvider: StreamProvider,
  ) {
    super();
  }

  public listen(done: { (): void }): void {
    console.log('LISTENING');

    this.streamProvider
      .ensureStreams()
      .pipe
      // switchMap() => {}
      ()
      .subscribe({ next: done });
  }

  public close(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.connectionProvider.gracefulShutdown().subscribe();
  }

  public on<
    EventKey extends keyof INatsEventsMap,
    EventCallback extends INatsEventsMap[EventKey] = INatsEventsMap[EventKey],
  >(event: EventKey, callback: EventCallback): void {
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
