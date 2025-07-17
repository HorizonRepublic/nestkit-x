import { DiscardPolicy, JetStreamManager, RetentionPolicy, StorageType, StoreCompression, StreamConfig } from 'nats';
import { catchError, defer, forkJoin, from, map, Observable, switchMap, tap } from 'rxjs';
import { IJetstreamTransportOptions } from './types/jetstream-transport.options';
import { LoggerService } from '@nestjs/common';
import { JsKind } from './types/enum';

export class JetStreamStreamManager {
  constructor(
    private readonly jsm$: Observable<JetStreamManager>,
    private readonly opts: IJetstreamTransportOptions,
    private readonly logger: LoggerService,
  ) {
  }

  public ensureAll(): Observable<void> {
    return forkJoin([
      this.ensure(JsKind.Event),
      this.ensure(JsKind.Command)])
      .pipe(map(() => void 0));
  }

  public ensure(kind: JsKind): Observable<void> {
    return this.ensureStream(this.buildCfg(kind));
  }

  /* ------------------------------------------------------------------ */

  public getStreamName(kind: JsKind): string {
    return `${this.opts.serviceName}_${kind}-stream`;
  }


  private ensureStream(cfg: StreamConfig): Observable<void> {
    return this.jsm$.pipe(
      switchMap((jsm) =>
        defer(() => from(jsm.streams.info(cfg.name))).pipe(
          switchMap((info) => {
            this.logger.log(`Updating stream: ${cfg.name}`, {
              current: info.config.subjects,
              next: cfg.subjects,
            });

            return from(jsm.streams.update(cfg.name, { subjects: cfg.subjects }));
          }),

          catchError(() => {
            this.logger.log(`Creating stream: ${cfg.name}`);
            return from(jsm.streams.add(cfg));
          }),
        ),
      ),

      tap(() => this.logger.log(`Stream ready: ${cfg.name}`)),

      map(() => void 0),
    );
  }

  private buildCfg(kind: JsKind): StreamConfig {
    const { serviceName } = this.opts;

    const common: StreamConfig = {
      discard: DiscardPolicy.Old,
      duplicate_window: 0,
      max_age: 0,
      max_bytes: 0,
      max_consumers: 0,
      max_msg_size: 0,
      max_msgs: 0,
      max_msgs_per_subject: 0,
      name: '',
      subjects: [],
      deny_delete: false,
      deny_purge: false,
      discard_new_per_subject: false,
      first_seq: 0,
      mirror_direct: false,
      sealed: false,
      storage: StorageType.File,
      retention: RetentionPolicy.Workqueue,
      num_replicas: 1,
      allow_direct: true,
      allow_rollup_hdrs: kind === JsKind.Event,
      compression: StoreCompression.None,
    };

    if (kind === JsKind.Event) {
      return {
        ...common,
        name: this.getStreamName(kind),
        subjects: [`${serviceName}.${JsKind.Event}.>`],
        description: `${JsKind.Event} stream for ${serviceName}`,
        max_consumers: 100,
        max_msg_size: 10 * 1024 ** 2,
        max_msgs_per_subject: 5_000_000,
        max_msgs: 50_000_000,
        max_bytes: 5 * 1024 ** 3,
        max_age: 7 * 24 * 60 * 60 * 1e9,
        duplicate_window: 2 * 60 * 1e9,
        discard: DiscardPolicy.Old,
      };
    }

    /* command */
    return {
      ...common,
      name: this.getStreamName(kind),
      subjects: [`${serviceName}.${JsKind.Command}.>`],
      description: `${JsKind.Command} stream for ${serviceName}`,
      max_consumers: 50,
      max_msg_size: 5 * 1024 ** 2,
      max_msgs_per_subject: 100_000,
      max_msgs: 1_000_000,
      max_bytes: 100 * 1024 ** 2,
      max_age: this.msToNs(180_000), // rpcTimeoutMs
      duplicate_window: 30 * 1e9,
      allow_rollup_hdrs: false,
      discard: DiscardPolicy.Old,
    };
  }

  private msToNs(ms: number): number {
    return ms * 1_000_000;
  }
}
