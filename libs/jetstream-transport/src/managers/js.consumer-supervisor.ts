// managers/js.consumer-supervisor.ts
import { from, map, merge, Observable, switchMap } from 'rxjs';
import { NatsConnection } from 'nats';
import { LoggerService } from '@nestjs/common';

import { JsKind } from '../const/enum';
import { JsConsumerManager } from './js.consumer-manager';
import { JetStreamStreamManager } from './js.stream-manager';
import { JsPullRunner } from './js.pull-runner';
import { JsMsgManager } from './js.msg-manager';

export class JsConsumerSupervisor {
  constructor(
    private readonly consumerMgr: JsConsumerManager,
    private readonly streamMgr: JetStreamStreamManager,
    private readonly conn$: Observable<NatsConnection>,
    private readonly pullTimeoutMs: number,
    private readonly logger: LoggerService,
    private readonly msgMgr: JsMsgManager,
  ) {}

  /** запускає pull‑цикли для Event‑ та/або Command‑стрімів */
  run(event: boolean, command: boolean): Observable<void> {
    const flows: Observable<void>[] = [];

    if (event) flows.push(this.start(JsKind.Event, false));
    if (command) flows.push(this.start(JsKind.Command, true));

    return merge(...flows).pipe(map(() => void 0));
  }

  /* ───── helpers ───── */

  private start(kind: JsKind, ackRpc: boolean): Observable<void> {
    return this.consumerMgr.ensure(this.streamMgr.getStreamName(kind), kind).pipe(
      switchMap((ci) =>
        this.conn$.pipe(
          switchMap((c) => from(c.jetstream().consumers.get(ci.stream_name, ci.name))),
        ),
      ),
      switchMap((consumer) =>
        JsPullRunner.create(consumer, {
          logger: this.logger,
          expiresMs: this.pullTimeoutMs,
          handle: (msg) => this.msgMgr.handle(msg, ackRpc),
        }).run(),
      ),
    );
  }
}
