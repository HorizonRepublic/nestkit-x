import { Injectable } from '@nestjs/common';
import { ConsumerProvider } from './consumer.provider';
import { JetStreamKind } from '../../enum';
import { Consumer, ConsumerInfo, ConsumerMessages } from 'nats';
import { from, Observable, of, switchMap } from 'rxjs';
import { ConnectionProvider } from '../../common/connection.provider';

@Injectable()
export class PullProvider {
  public constructor(
    private readonly consumerProvider: ConsumerProvider,
    private readonly connectionProvider: ConnectionProvider,
  ) {
    this.consumerProvider.consumerMap$.subscribe({
      next: (consumerMap) => {
        const evConsumer = consumerMap.get(JetStreamKind.Event);
        const cmdConsumer = consumerMap.get(JetStreamKind.Command);

        // run in parallel in rxjs
        if (evConsumer) this.pullConsumer(evConsumer);
        if (cmdConsumer) this.pullConsumer(cmdConsumer);
      },
    });
  }

  protected pullConsumer(consumer: ConsumerInfo): Observable<ConsumerMessages> {
    return of(consumer).pipe(
      switchMap((consumerInfo) => this.getConsumer(consumerInfo)),

      switchMap((consumer) => {
        const res = consumer.fetch();

        return from(res);
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
