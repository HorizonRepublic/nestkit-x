import { Codec, JsMsg, NatsConnection } from 'nats';
import { catchError, finalize, from, Observable, of, switchMap } from 'rxjs';
import { LoggerService } from '@nestjs/common';

import { JetstreamEvent, JetstreamHeaders } from '../index';
import { JsEventBus } from '../registries/js-event.bus';
import { JetStreamContext } from '../jetstream.context';
import { MessageHandler } from '@nestjs/microservices';

/**
 * Manages JetStream message processing with handler resolution and response publishing.
 *
 * Handles complete message processing pipeline including handler resolution, message
 * decoding, context creation, handler execution, and response publishing for RPC patterns.
 * Provides comprehensive error handling and message acknowledgment management.
 */
export class JsMsgManager {
  /**
   * Initializes message manager with dependencies and handler resolver.
   *
   * @param conn$ - Observable of NATS connection for response publishing
   * @param codec - Message codec for encoding/decoding payloads
   * @param logger - Logger service for error tracking
   * @param bus - Event bus for error event emission
   * @param resolver - Handler resolver function provided by strategy
   */
  constructor(
    private readonly conn$: Observable<NatsConnection>,
    private readonly codec: Codec<any>,
    private readonly logger: LoggerService,
    private readonly bus: JsEventBus,
    private readonly resolver: (s: string) => MessageHandler | null,
  ) {}

  /**
   * Processes complete JetStream message with handler execution and response handling.
   *
   * Resolves handler by subject, decodes message data, creates context, executes handler,
   * and handles response publishing for RPC patterns. Provides proper message acknowledgment
   * and error handling throughout the processing pipeline.
   *
   * @param msg - JetStream message to process
   * @param isRpc - Whether message requires RPC-style response handling
   * @returns Observable that completes when message processing finishes
   */
  public handle(msg: JsMsg, isRpc: boolean): Observable<void> {
    const handler = this.resolver(msg.subject);
    if (!handler) {
      msg.term(); // Terminate message processing for unhandled subjects

      return of(void 0);
    }

    const data = this.codec.decode(msg.data);
    const ctx = new JetStreamContext([msg]);
    const res$ = this.toObs(handler(data, ctx));
    const reply = msg.headers?.get(JetstreamHeaders.ReplyTo);

    // Handle RPC pattern with response publishing
    if (isRpc && reply) {
      return res$.pipe(
        switchMap((v) => this.publish(reply, v)),
        catchError((e) => this.publishError(reply, e)),
        finalize(() => msg.ack()),
      );
    }

    // Handle event pattern with error logging
    const handleEventError = (e: Error) => {
      this.logger.error(`Handler error (${msg.subject}): ${e.message}`);
      msg.nak(); // Negative acknowledgment for retry
      this.bus.emit(JetstreamEvent.Error, e);
      return of(void 0);
    };

    return res$.pipe(
      catchError(handleEventError),
      finalize(() => msg.ack()),
    );
  }

  /**
   * Publishes successful response to a reply subject.
   *
   * @param reply - Reply subject for response
   * @param payload - Response payload to publish
   * @returns Observable that completes when response is published
   */
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

  /**
   * Publishes error response to reply subject.
   *
   * @param reply - Reply subject for error response
   * @param err - Error to publish
   * @returns Observable that completes when error response is published
   */
  private publishError(reply: string, err: any): Observable<void> {
    const errorResponse = {
      error: err instanceof Error ? err.message : String(err),
    };

    return this.publish(reply, errorResponse);
  }

  /**
   * Converts a handler result to Observable for consistent processing.
   *
   * Handles various return types including promises, observables, and synchronous values.
   * Ensures all handler results are processed through the same reactive pipeline.
   *
   * @param v - Handler result of any type
   * @returns Observable representation of handler result
   */
  private toObs(v: any): Observable<any> {
    // First, convert to promise to handle sync values and promises uniformly
    const hasSubscribe = (x: any): boolean => x && typeof x.subscribe === 'function';

    return from(Promise.resolve(v)).pipe(switchMap((x) => (hasSubscribe(x) ? x : of(x))));
  }
}
