import { Codec, JsMsg, NatsConnection } from 'nats';
import { catchError, finalize, from, Observable, of, switchMap } from 'rxjs';
import { LoggerService } from '@nestjs/common';

import { JetstreamEvent, JetstreamHeaders } from '../index';
import { JsEventBus } from '../registries/js-event.bus';
import { JetStreamContext } from '../jetstream.context';
import { MessageHandler } from '@nestjs/microservices';

export class JsMsgManager {
  constructor(
    private readonly conn$: Observable<NatsConnection>,
    private readonly codec: Codec<any>,
    private readonly logger: LoggerService,
    private readonly bus: JsEventBus,
    /** стратегії передають власний resolver */
    private readonly resolver: (s: string) => MessageHandler | null,
  ) {}

  /** повна обробка одного JsMsg */
  handle(msg: JsMsg, isRpc: boolean): Observable<void> {
    const handler = this.resolver(msg.subject);
    if (!handler) {
      msg.term();
      return of(void 0);
    }

    const data = this.codec.decode(msg.data);
    const ctx = new JetStreamContext([msg]);

    const res$ = this.toObs(handler(data, ctx));
    const reply = msg.headers?.get(JetstreamHeaders.ReplyTo);

    if (isRpc && reply) {
      return res$.pipe(
        switchMap((v) => this.publish(reply, v)),
        catchError((e) => this.publishError(reply, e)),
        finalize(() => msg.ack()),
      );
    }

    return res$.pipe(
      catchError((e) => {
        this.logger.error(`Handler error (${msg.subject}): ${e.message}`);
        msg.nak();
        this.bus.emit(JetstreamEvent.Error, e);
        return of(void 0);
      }),
      finalize(() => msg.ack()),
    );
  }

  /* ───────── helpers ───────── */

  private publish(reply: string, payload: any): Observable<void> {
    return this.conn$.pipe(
      switchMap((c) => {
        c.publish(reply, this.codec.encode(payload));
        return of(void 0);
      }),
      catchError((e) => {
        this.logger.error(`Failed to publish response: ${e.message}`);
        return of(void 0);
      }),
    );
  }

  private publishError(reply: string, err: any) {
    return this.publish(reply, {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  private toObs(v: any): Observable<any> {
    return from(Promise.resolve(v)).pipe(
      switchMap((x) => (x && typeof x.subscribe === 'function' ? x : of(x))),
    );
  }
}
