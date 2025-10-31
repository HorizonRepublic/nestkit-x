import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConnectionProvider } from '../../common/connection.provider';
import { catchError, forkJoin, from, map, Observable, switchMap, tap } from 'rxjs';
import { NatsError, StreamInfo, StreamUpdateConfig } from 'nats';
import { StreamConfig } from 'nats/lib/jetstream/jsapi_types';
import { IJetstreamTransportOptions } from '../../common/types';
import { JETSTREAM_TRANSPORT_OPTIONS } from '../../common/const';
import { JetStreamKind } from '../../enum';
import { streamConfig } from '../const';
import { JetStreamErrorCode } from '../enum';

@Injectable()
export class StreamProvider {
  private readonly logger = new Logger(StreamProvider.name);

  public constructor(
    @Inject(JETSTREAM_TRANSPORT_OPTIONS)
    private readonly options: IJetstreamTransportOptions,
    private readonly connectionProvider: ConnectionProvider,
  ) {}

  public create(): Observable<void> {
    return forkJoin([
      this.createForKind(JetStreamKind.Event), // event
      this.createForKind(JetStreamKind.Command), // command
    ]).pipe(map(() => void 0));
  }

  public getStreamName(kind: JetStreamKind): string {
    return `${this.options.name}_${kind}-stream`;
  }

  protected getSubjects(kind: JetStreamKind): string[] {
    return [`${this.options.name}.${kind}.>`];
  }

  protected createForKind(kind: JetStreamKind): Observable<StreamInfo> {
    const config = {
      ...streamConfig.base,
      ...streamConfig[kind],
      name: this.getStreamName(kind),
      subjects: this.getSubjects(kind),
      description: `JetStream stream for ${this.options.name} ${kind} messages`,
    };

    this.logger.log(`Ensure stream requested: ${config.name}`);

    return this.info(config.name) // check if a stream exists
      .pipe(
        // if not, create it
        switchMap(() => this.update(config.name, config)),

        catchError((err: NatsError) => {
          if (err.api_error?.err_code == JetStreamErrorCode.StreamNotFound) {
            return this.new(config);
          }

          throw err;
        }),
      );
  }

  protected info(streamName: string): Observable<StreamInfo> {
    return this.connectionProvider.jsm.pipe(
      tap(() => {
        this.logger.debug(`Checking stream existence: ${streamName}`);
      }),

      switchMap((jsm) => from(jsm.streams.info(streamName))),
    );
  }

  protected new(config: StreamConfig): Observable<StreamInfo> {
    return this.connectionProvider.jsm.pipe(
      switchMap((jsm) => from(jsm.streams.add(config))),

      tap(() => {
        this.logger.log(`New stream created: ${config.name}`);
      }),
    );
  }

  protected update(streamName: string, config: StreamUpdateConfig): Observable<StreamInfo> {
    return this.connectionProvider.jsm.pipe(
      tap(() => {
        this.logger.log(
          `Stream exists, updating: ${streamName} (subjects: ${config.subjects.length})`,
        );
      }),

      switchMap((jsm) => from(jsm.streams.update(streamName, config))),
    );
  }
}
