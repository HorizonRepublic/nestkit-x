import { ConsumerConfig, ConsumerInfo, JetStreamManager } from 'nats';
import { catchError, defer, from, Observable, switchMap, tap } from 'rxjs';
import { LoggerService } from '@nestjs/common';
import {
  IJetstreamTransportOptions,
  JetStreamErrorCodes as EC,
  JsConsumerConfigBuilder,
  JsKind,
} from '@nestkit-x/jetstream-transport';

/* ────────────────────────────────────────────────────────────────────────── */

export class JsConsumerManager {
  constructor(
    private readonly jsm$: Observable<JetStreamManager>,
    private readonly opts: IJetstreamTransportOptions,
    private readonly logger: LoggerService,
  ) {}

  /* ───────── public API ───────── */

  ensure(stream: string, kind: JsKind): Observable<ConsumerInfo> {
    const cfg = this.buildConfig(kind);

    return this.jsm$.pipe(
      switchMap((jsm) =>
        this.getExisting(jsm, stream, cfg).pipe(
          // ➜ already exists
          catchError((err) =>
            err.api_error?.err_code === EC.ConsumerNotFound
              ? this.create(jsm, stream, cfg) // ➜ create / handle race
              : this.throwInfoErr(err, stream, kind, cfg.durable_name!),
          ),
        ),
      ),
      tap((ci) => this.logger.log(`Consumer ready: ${cfg.name}`)),
    );
  }

  /* ───────── private helpers ───────── */

  private getExisting(jsm: JetStreamManager, stream: string, cfg: ConsumerConfig) {
    return defer(() => from(jsm.consumers.info(stream, cfg.durable_name!))).pipe(
      tap((ci) =>
        this.logger.log(`Consumer using: ${cfg.durable_name}`, {
          stream,
          kind: cfg.durable_name?.split('_').pop(),
          numPending: ci.num_pending,
        }),
      ),
    );
  }

  private create(jsm: JetStreamManager, stream: string, cfg: ConsumerConfig) {
    return defer(() => from(jsm.consumers.add(stream, cfg))).pipe(
      tap(() => this.logger.log(`Consumer created: ${cfg.durable_name}`, { stream })),
      catchError((err) =>
        err.api_error?.err_code === EC.ConsumerExists
          ? from(jsm.consumers.info(stream, cfg.durable_name!)) // race‑condition
          : this.throwCreateErr(err, stream, cfg),
      ),
    );
  }

  private throwInfoErr(err: any, stream: string, kind: JsKind, durable: string): never {
    this.logger.error(`Consumer info failed: ${durable}`, {
      stream,
      kind,
      error: err.message,
      code: err.api_error?.err_code,
    });
    throw err;
  }

  private throwCreateErr(err: any, stream: string, cfg: ConsumerConfig): never {
    this.logger.error(`Consumer create failed: ${cfg.durable_name}`, {
      stream,
      error: err.message,
      code: err.api_error?.err_code,
      cfg,
    });
    throw err;
  }

  /* ───────── config builder ───────── */

  private buildConfig(kind: JsKind): ConsumerConfig {
    const builder = JsConsumerConfigBuilder.create(this.opts.serviceName).forKind(kind);

    const userOverride: Partial<ConsumerConfig> | undefined = this.opts.consumerConfig?.[kind];

    if (userOverride) builder.with(userOverride);

    return builder.with({ filter_subject: `${this.opts.serviceName}.${kind}.>` }).build();
  }
}
