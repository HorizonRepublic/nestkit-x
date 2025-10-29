import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConsumerProvider } from './consumer.provider';
import { JetStreamKind } from '../../enum';
import { Consumer, ConsumerInfo, JsMsg } from 'nats';
import {
  catchError,
  concat,
  EMPTY,
  from,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { ConnectionProvider } from '../../common/connection.provider';

@Injectable()
export class PullProvider implements OnModuleDestroy {
  private readonly destroy$ = new Subject<void>();

  public constructor(
    private readonly consumerProvider: ConsumerProvider,
    private readonly connectionProvider: ConnectionProvider,
  ) {
    this.consumerProvider.consumerMap$
      .pipe(
        switchMap((consumerMap) => {
          console.log('Consumer subscription started');
          const evConsumer = consumerMap.get(JetStreamKind.Event);
          const cmdConsumer = consumerMap.get(JetStreamKind.Command);

          const flows: Observable<JsMsg>[] = [];

          if (evConsumer) flows.push(this.pullConsumer(evConsumer));
          if (cmdConsumer) flows.push(this.pullConsumer(cmdConsumer));

          return merge(...flows);
        }),
        catchError(() => EMPTY),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  public onModuleDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected pullConsumer(consumerInfo: ConsumerInfo): Observable<JsMsg> {
    return of(consumerInfo).pipe(
      switchMap((info) => this.getConsumer(info)),
      switchMap((consumer) => {
        return from(consumer.consume()).pipe(
          switchMap((messages) => {
            console.log('Consumer started, waiting for messages...');

            // Обгортаємо в concat, щоб після завершення кинути помилку
            return concat(
              from(messages as AsyncIterable<JsMsg>).pipe(
                tap((msg: JsMsg) => {
                  console.log('MSG', msg);
                  msg.ack();
                }),
              ),
              // Після завершення стріму кидаємо помилку для реконнекту
              throwError(() => new Error('Consumer stream completed - reconnecting')),
            );
          }),
          catchError((err) => {
            console.log('ERROR in message stream', err);
            return throwError(() => err);
          }),
        );
      }),
      catchError((err) => {
        console.log('Consumer error, reconnecting in 2s...', err);
        return timer(2000).pipe(switchMap(() => this.pullConsumer(consumerInfo)));
      }),
    );
  }

  protected getConsumer(consumerInfo: ConsumerInfo): Observable<Consumer> {
    return this.connectionProvider.jsm.pipe(
      switchMap((jsm) => {
        const consumerPromise = jsm
          .jetstream()
          .consumers.get(consumerInfo.stream_name, consumerInfo.name);

        return from(consumerPromise);
      }),
    );
  }
}
