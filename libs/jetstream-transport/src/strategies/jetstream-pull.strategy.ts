import {
  AckPolicy,
  Consumer,
  DeliverPolicy,
  DiscardPolicy,
  JsMsg,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
  StoreCompression,
  StreamConfig,
} from 'nats';
import { catchError, defer, finalize, from, Observable, of, repeat, switchMap, timer } from 'rxjs';
import { JetstreamStrategy } from './jetstream.strategy';
import { getJetstreamDurableName, getJetStreamFilterSubject, getStreamName } from '../helpers';
import {
  JetstreamConsumerSetup,
  JetstreamHeaders,
  JetstreamMessageType,
} from '@nestkit-x/jetstream-transport';

export class JetstreamPullStrategy extends JetstreamStrategy {
  /* ---------- таймаути і ліміти ---------- */
  private readonly rpcTimeoutMs = 180_000; // 3 min
  private readonly eventTimeoutMs = 60_000; // 1 min
  private readonly fetchExpiresMs = 30_000; // pull timeout
  private readonly maxAckPendingEvents = 50; // паралельність для івентів
  private readonly maxAckPendingRpc = 5; // паралельність RPC

  /* ================================================================
   *  STREAMS
   * ================================================================ */

  /* ---------- STREAM CONFIGS (повністю) ---------- */

  protected override setupEventStream(): Observable<void> {
    const { serviceName } = this.options;

    const cfg: StreamConfig = {
      /* технічні прапорці — залишив як у тебе */
      deny_delete: false,
      deny_purge: false,
      discard_new_per_subject: false,
      first_seq: 0,
      max_consumers: 100,
      max_msg_size: 10 * 1024 * 1024, // 10 MB
      max_msgs_per_subject: 5_000_000,
      mirror_direct: false,
      sealed: false,

      /* ключові параметри сховища */
      name: `${getStreamName(serviceName)}-events`,
      subjects: [`${serviceName}.event.>`],
      description: `Event stream for ${serviceName}`,
      storage: StorageType.File,
      retention: RetentionPolicy.Workqueue,
      num_replicas: 1,

      /* ліміти довгого зберігання */
      max_msgs: 50_000_000, // 50 M
      max_bytes: 5 * 1024 ** 3, // 5 GB
      max_age: 7 * 24 * 60 * 60 * 1e9, // 7 днів
      duplicate_window: 2 * 60 * 1e9, // 2 хв

      /* поведінка дискарду й I/O */
      discard: DiscardPolicy.Old,
      allow_direct: true,
      allow_rollup_hdrs: true,
      compression: StoreCompression.None,
    };

    return this.getJetStreamManager().pipe(switchMap((jsm) => this.createOrUpdateStream(jsm, cfg)));
  }

  protected override setupCommandStream(): Observable<void> {
    const { serviceName } = this.options;

    const cfg: StreamConfig = {
      deny_delete: false,
      deny_purge: false,
      discard_new_per_subject: false,
      first_seq: 0,
      max_consumers: 50,
      max_msg_size: 5 * 1024 * 1024, // 5 MB
      max_msgs_per_subject: 100_000,
      mirror_direct: false,
      sealed: false,

      name: `${getStreamName(serviceName)}-commands`,
      subjects: [`${serviceName}.cmd.>`],
      description: `Command stream for ${serviceName}`,
      storage: StorageType.File,
      retention: RetentionPolicy.Workqueue,
      num_replicas: 1,

      /* ліміти для швидкого очищення RPC */
      max_msgs: 1_000_000, // 1 M
      max_bytes: 100 * 1024 ** 2, // 100 MB
      max_age: this.msToNs(this.rpcTimeoutMs), // 3 хв
      duplicate_window: 30 * 1e9, // 30 сек

      discard: DiscardPolicy.Old,
      allow_direct: true,
      allow_rollup_hdrs: false,
      compression: StoreCompression.None,
    };

    return this.getJetStreamManager().pipe(switchMap((jsm) => this.createOrUpdateStream(jsm, cfg)));
  }

  /* ================================================================
   *  CONSUMERS
   * ================================================================ */

  protected override setupEventHandlers(): Observable<void> {
    if (this.getRegisteredPatterns().events.length === 0) return of(void 0);

    return this.createConsumer(this.consumerCfg(JetstreamMessageType.Event)).pipe(
      switchMap((c) => this.pullLoop(c, false)),
    );
  }

  protected override setupMessageHandlers(): Observable<void> {
    if (this.getRegisteredPatterns().messages.length === 0) return of(void 0);

    return this.createConsumer(this.consumerCfg(JetstreamMessageType.Command)).pipe(
      switchMap((c) => this.pullLoop(c, true)),
    );
  }

  /* ================================================================
   *  PULL LOOP (без рекурсії)
   * ================================================================ */

  private pullLoop(consumer: Consumer, isRpc: boolean): Observable<void> {
    const tag = isRpc ? 'RPC' : 'EVENT';

    return defer(() => from(consumer.info())).pipe(
      switchMap(() => defer(() => this.fetchAndProcess(consumer, isRpc)).pipe(repeat())),
      catchError((err) => {
        this.logger.error(`${tag} pull error: ${err.message}`);
        return timer(1000).pipe(switchMap(() => this.pullLoop(consumer, isRpc)));
      }),
    );
  }

  private fetchAndProcess(consumer: Consumer, isRpc: boolean): Observable<void> {
    return defer(() => from(consumer.next({ expires: this.fetchExpiresMs }))).pipe(
      switchMap((msg: JsMsg | null) => {
        if (!msg) return of(void 0);
        return this.handleMsg(msg, isRpc);
      }),
      catchError((err) => {
        if (err.message?.includes('timeout')) return of(void 0);
        this.logger.error(`Fetch error: ${err.message}`);
        return of(void 0);
      }),
    );
  }

  /* ================================================================
   *  MESSAGE HANDLING
   * ================================================================ */

  private handleMsg(msg: JsMsg, isRpc: boolean): Observable<void> {
    const handler = this.getHandlerByPattern(msg.subject);
    if (!handler) {
      msg.term();
      return of(void 0);
    }

    const data = this.codec.decode(msg.data);
    const ctx = {
      subject: msg.subject,
      headers: msg.headers,
      extendProcessingTime: () => msg.working(),
    };

    const result$ = this.handleAsyncResult(handler(data, ctx));
    const replyTo = msg.headers?.get(JetstreamHeaders.ReplyTo);

    if (isRpc && replyTo) {
      return result$.pipe(
        switchMap((resp) => {
          this.publishResponse(replyTo, resp);
          return of(void 0);
        }),
        catchError((err) => {
          this.publishErrorResponse(replyTo, err);
          return of(void 0);
        }),
        finalize(() => msg.ack()),
      );
    }

    return result$.pipe(
      catchError((err) => {
        this.logger.error(`Handler error (${msg.subject}): ${err.message}`);
        msg.nak();
        return of(void 0);
      }),
      finalize(() => msg.ack()),
    );
  }

  /* ================================================================
   *  CONSUMER CONFIG
   * ================================================================ */

  private consumerCfg(t: JetstreamMessageType): JetstreamConsumerSetup {
    const { serviceName } = this.options;
    const isRpc = t === JetstreamMessageType.Command;

    return {
      stream: `${getStreamName(serviceName)}-${isRpc ? 'commands' : 'events'}`,
      config: {
        durable_name: getJetstreamDurableName(serviceName, t),
        filter_subject: getJetStreamFilterSubject(serviceName, t),
        deliver_policy: DeliverPolicy.All,
        replay_policy: ReplayPolicy.Instant,
        ack_policy: AckPolicy.Explicit,
        ack_wait: this.msToNs(isRpc ? this.rpcTimeoutMs : this.eventTimeoutMs),
        max_deliver: isRpc ? 1 : 5,
        max_ack_pending: isRpc ? this.maxAckPendingRpc : this.maxAckPendingEvents,
      },
    };
  }

  private msToNs(ms: number): number {
    return ms * 1_000_000;
  }
}
