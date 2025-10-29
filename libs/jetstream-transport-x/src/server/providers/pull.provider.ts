import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConsumerProvider } from './consumer.provider';
import { JetStreamKind } from '../../enum';
import { Consumer, ConsumerInfo, JsMsg } from 'nats';
import {
  catchError,
  defer,
  EMPTY,
  from,
  merge,
  Observable,
  of,
  repeat,
  Subject,
  Subscription,
  switchMap,
  take,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { ConnectionProvider } from '../../common/connection.provider';

@Injectable()
export class PullProvider implements OnModuleDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly activeConsumers = new Map<JetStreamKind, Observable<JsMsg>>();
  private readonly subscription?: Subscription; // Зберігаємо subscription

  public constructor(
    private readonly consumerProvider: ConsumerProvider,
    private readonly connectionProvider: ConnectionProvider,
  ) {
    this.subscription = this.consumerProvider.consumerMap$
      .pipe(
        take(1),
        tap((consumerMap) => {
          console.log('Consumer subscription started');
          const evConsumer = consumerMap.get(JetStreamKind.Event);
          const cmdConsumer = consumerMap.get(JetStreamKind.Command);

          const flows: Observable<JsMsg>[] = [];

          if (evConsumer) {
            const flow = this.pullConsumer(evConsumer);

            this.activeConsumers.set(JetStreamKind.Event, flow);
            flows.push(flow);
          }

          if (cmdConsumer) {
            const flow = this.pullConsumer(cmdConsumer);

            this.activeConsumers.set(JetStreamKind.Command, flow);
            flows.push(flow);
          }

          merge(...flows)
            .pipe(takeUntil(this.destroy$))
            .subscribe();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  public onModuleDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.activeConsumers.clear();
    this.subscription?.unsubscribe(); // Явно відписуємось
  }

  protected pullConsumer(consumerInfo: ConsumerInfo): Observable<JsMsg> {
    return defer(() => {
      console.log('🔄 Starting pullConsumer for', consumerInfo.name);

      return of(consumerInfo).pipe(
        switchMap((info) => this.getConsumer(info)),
        tap(() => {
          console.log('✅ Consumer obtained');
        }),
        switchMap((consumer) => {
          return from(consumer.consume()).pipe(
            tap(() => {
              console.log('📡 consume() called');
            }),
            switchMap((messages) => {
              console.log('📨 MESSAGES iterator received');

              return from(messages as AsyncIterable<JsMsg>).pipe(
                tap({
                  next: (msg) => {
                    console.log('✉️ MSG received', msg.subject);
                  },
                  complete: () => {
                    console.log('⚠️ Message stream COMPLETED');
                  },
                }),
              );
            }),
            tap((msg: JsMsg) => {
              console.log('MSG', msg);
              msg.ack();
            }),
          );
        }),
      );
    }).pipe(
      repeat({
        delay: (attemptCount) => {
          console.log(`🔁 Restarting consumer (attempt ${attemptCount})...`);
          return timer(1000);
        },
      }),
      catchError((err) => {
        console.log('💥 Fatal error in pullConsumer', err);
        return EMPTY;
      }),
      takeUntil(this.destroy$),
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
