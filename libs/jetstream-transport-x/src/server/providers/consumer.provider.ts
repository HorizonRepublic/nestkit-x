import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConnectionProvider } from '../../common/connection.provider';
import { JetStreamKind } from '../../enum';
import { catchError, forkJoin, from, map, Observable, Subject, switchMap, tap } from 'rxjs';
import { StreamProvider } from './stream.provider';
import { consumerConfig } from '../const';
import { JETSTREAM_TRANSPORT_OPTIONS } from '../../const';
import { IJetstreamTransportOptions } from '../types/jetstream-transport.options';
import { ConsumerInfo, NatsError } from 'nats';
import { JetStreamErrorCode } from '../enum';

@Injectable()
export class ConsumerProvider {
  private readonly logger = new Logger(ConsumerProvider.name);

  // Subject для емітингу готових consumers
  private readonly consumers$ = new Subject<Map<JetStreamKind, ConsumerInfo>>();

  public constructor(
    @Inject(JETSTREAM_TRANSPORT_OPTIONS)
    private readonly options: IJetstreamTransportOptions,
    private readonly connectionProvider: ConnectionProvider,
    private readonly streamProvider: StreamProvider,
  ) {}

  public get consumerMap$(): Observable<Map<JetStreamKind, ConsumerInfo>> {
    return this.consumers$.asObservable();
  }

  public create(): Observable<void> {
    return forkJoin({
      command: this.createForKind(JetStreamKind.Command),
      event: this.createForKind(JetStreamKind.Event),
    }).pipe(
      // set map to consumers$ to retrieve it in the next step
      tap((results) => {
        const map = new Map<JetStreamKind, ConsumerInfo>([
          [JetStreamKind.Command, results.command],
          [JetStreamKind.Event, results.event],
        ]);

        this.consumers$.next(map);
      }),

      // return void 0 to indicate success
      map(() => void 0),
    );
  }

  protected createForKind(kind: JetStreamKind): Observable<ConsumerInfo> {
    const streamName = this.streamProvider.getStreamName(kind);
    const config = consumerConfig[kind](this.options.name, kind);

    return this.connectionProvider.jsm.pipe(
      switchMap((jsm) =>
        // check consumer existence
        from(jsm.consumers.info(streamName, config.durable_name ?? '')).pipe(
          // log
          tap(() => {
            this.logger.log(`Consumer exists: ${config.durable_name}`);
          }),

          catchError((err: NatsError) => {
            // create consumer if it doesn't exist'
            if (err.api_error?.err_code === JetStreamErrorCode.ConsumerNotFound) {
              this.logger.log(`Creating consumer: ${config.durable_name}`);

              return from(jsm.consumers.add(streamName, config));
            }

            throw err;
          }),
        ),
      ),
    );
  }
}
