import { Codec, headers, JsMsg, NatsConnection } from 'nats';
import { catchError, finalize, from, map, Observable, of, switchMap } from 'rxjs';
import { Logger } from '@nestjs/common';

import { JsEventBus } from '../registries/js-event.bus';
import { JetStreamContext } from '../jetstream.context';
import { MessageHandler } from '@nestjs/microservices';
import { JetstreamEvent, JetstreamHeaders } from '../const/enum';

/**
 * Manages JetStream message processing with handler resolution and response publishing.
 *
 * Handles complete message processing pipeline including handler resolution, message
 * decoding, context creation, handler execution, and response publishing for RPC patterns.
 * Provides comprehensive error handling and message acknowledgment management.
 */
export class JsMsgManager {
  private readonly logger = new Logger(JsMsgManager.name);

  /**
   * Initializes message manager with dependencies and handler resolver.
   *
   * @param conn$ Observable of NATS connection for response publishing.
   * @param codec Message codec for encoding/decoding payloads.
   * @param bus Event bus for error event emission.
   * @param resolver Handler resolver function provided by strategy.
   */
  public constructor(
    private readonly conn$: Observable<NatsConnection>,
    private readonly codec: Codec<unknown>,
    private readonly bus: JsEventBus,
    private readonly resolver: (s: string) => MessageHandler | null,
  ) {}

  /**
   * Processes complete JetStream message with handler execution and response handling.
   *
   * @param msg
   * @param isRpc
   */
  public handle(msg: JsMsg, isRpc: boolean): Observable<void> {
    const handler = this.resolver(msg.subject);

    if (!handler) {
      msg.term();
      return of(void 0);
    }

    const data = this.codec.decode(msg.data);
    const ctx = new JetStreamContext([msg]);
    const res$ = this.toObs(handler(data, ctx));
    const reply = msg.headers?.get(JetstreamHeaders.ReplyTo);

    // Handle RPC pattern with response publishing
    if (isRpc && reply) {
      // ✅ Отримуємо correlation ID з оригінального повідомлення
      const correlationId = msg.headers?.get(JetstreamHeaders.CorrelationId);

      return res$.pipe(
        switchMap((v) => this.publish(reply, v, correlationId)), // ✅ Передаємо correlation ID
        catchError((e) => this.publishError(reply, e, correlationId)), // ✅ І для помилок теж
        finalize(() => {
          msg.ack();
        }),
      );
    }

    // Event pattern handling remains the same
    const handleEventError = (e: Error): Observable<void> => {
      this.logger.error(`Handler error (${msg.subject}): ${e.message}`);
      msg.nak();
      this.bus.emit(JetstreamEvent.Error, e);
      return of(void 0);
    };

    return res$.pipe(
      map(() => void 0),
      catchError(handleEventError),
      finalize(() => {
        msg.ack();
      }),
    );
  }

  /**
   * Publishes successful response to a reply subject with correlation ID.
   *
   * @param reply
   * @param payload
   * @param correlationId
   */
  private publish(reply: string, payload: unknown, correlationId?: string): Observable<void> {
    return this.conn$.pipe(
      switchMap((c) => {
        const hdrs = headers();

        this.logger.debug(`Publishing payload before encoding:`, {
          payload,
          type: typeof payload,
          isNull: payload === null,
          isUndefined: payload === undefined,
        });

        // ✅ Копіюємо correlation ID в відповідь
        if (correlationId) {
          hdrs.set(JetstreamHeaders.CorrelationId, correlationId);
          this.logger.debug(`→ [Response] Publishing to ${reply} (cid: ${correlationId})`);
        } else {
          this.logger.warn(`→ [Response] Publishing to ${reply} without correlation ID`);
        }

        c.publish(reply, this.codec.encode(payload), { headers: hdrs });
        return of(void 0);
      }),
      catchError((e) => {
        this.logger.error(`Failed to publish response to ${reply}:`, e);
        return of(void 0);
      }),
    );
  }

  /**
   * Publishes error response to reply subject with correlation ID.
   *
   * @param reply
   * @param err
   * @param correlationId
   */
  private publishError(reply: string, err: unknown, correlationId?: string): Observable<void> {
    const errorResponse = {
      error: err instanceof Error ? err.message : String(err),
    };

    return this.publish(reply, errorResponse, correlationId); // ✅ Передаємо correlation ID
  }

  /**
   * Converts a handler result to Observable for consistent processing.
   *
   * Handles various return types, including promises, observables, async iterables, and synchronous values.
   * Ensures all handler results are processed through the same reactive pipeline without leaking nested Observables.
   *
   * @param v Handler result of any type.
   * @returns Observable representation of a handler result.
   */
  private toObs(v: unknown): Observable<unknown> {
    const isObservable = (x: unknown): x is Observable<unknown> =>
      x !== null &&
      typeof x === 'object' &&
      'subscribe' in x &&
      typeof x['subscribe'] === 'function';

    const isPromise = (x: unknown): x is Promise<unknown> =>
      x !== null && typeof x === 'object' && 'then' in x && typeof x.then === 'function';

    const isAsyncIterable = (x: unknown): x is AsyncIterable<unknown> =>
      x !== null && typeof x === 'object' && Symbol.asyncIterator in x;

    const toObsInner = (x: unknown): Observable<unknown> => {
      if (isObservable(x)) {
        return x;
      }

      if (isAsyncIterable(x)) {
        return from(x);
      }

      if (isPromise(x)) {
        return from(x).pipe(switchMap((y) => toObsInner(y)));
      }

      return of(x);
    };

    return toObsInner(v);
  }
}
