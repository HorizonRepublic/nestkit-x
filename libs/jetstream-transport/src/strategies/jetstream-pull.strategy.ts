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
import { catchError, defer, finalize, from, map, Observable, of, switchMap, timer } from 'rxjs';
import { JetstreamStrategy } from './jetstream.strategy';
import { getJetstreamDurableName, getJetStreamFilterSubject, getStreamName } from '../helpers';
import {
  JetstreamConsumerSetup,
  JetstreamHeaders,
  JetstreamMessageType,
} from '@nestkit-x/jetstream-transport';

export class JetstreamPullStrategy extends JetstreamStrategy {
  // HTTP timeout = 120 секунд, залишаємо люфт
  private readonly httpTimeoutMs = 120_000; // 2 хвилини
  private readonly rpcTimeoutMs = 180_000; // 3 хвилини (з люфтом)
  private readonly eventTimeoutMs = 30_000; // 30 секунд для events

  private readonly fetchExpires = 30_000;
  private readonly maxAckPending = 10;

  // Дедуплікація
  private readonly processingMessages = new Set<string>();

  /* ================================================================
   *  ABSTRACT METHODS IMPLEMENTATION
   * ================================================================ */

  /**
   * Events Stream - довге зберігання, розслаблені таймаути
   */
  protected override setupEventStream(): Observable<void> {
    const { serviceName } = this.options;

    const eventCfg: StreamConfig = {
      name: `${getStreamName(serviceName)}-events`,
      subjects: [`${serviceName}.event.>`],
      description: `Event stream for ${serviceName}`,
      storage: StorageType.File,
      retention: RetentionPolicy.Workqueue,
      num_replicas: 1, // todo: to env config

      // Довге зберігання для events
      max_msgs: 50_000_000, // 50М повідомлень
      max_msgs_per_subject: 5_000_000, // 5М на subject
      max_bytes: 5 * 1024 * 1024 * 1024, // 5GB
      max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 днів
      max_msg_size: 10 * 1024 * 1024, // 10MB
      duplicate_window: 2 * 60 * 1_000_000_000, // 2 хвилини
      discard: DiscardPolicy.Old,

      // Стандартні налаштування
      allow_direct: true,
      allow_rollup_hdrs: true,
      compression: StoreCompression.None,
      sealed: false,
      no_ack: false,
      deny_delete: false,
      deny_purge: false,
      max_consumers: 100,
      first_seq: 0,
      mirror_direct: false,
      discard_new_per_subject: false,
    };

    return this.getJetStreamManager().pipe(
      switchMap((jsm) => this.createOrUpdateStream(jsm, eventCfg)),
    );
  }

  /**
   * Commands Stream - агресивні таймаути для RPC
   */
  protected override setupCommandStream(): Observable<void> {
    const { serviceName } = this.options;

    const commandCfg: StreamConfig = {
      name: `${getStreamName(serviceName)}-commands`,
      subjects: [`${serviceName}.cmd.>`],
      description: `Command stream for ${serviceName}`,
      storage: StorageType.File,
      retention: RetentionPolicy.Workqueue,
      num_replicas: 1,

      // Швидке видалення для RPC
      max_msgs: 1_000_000, // 1М повідомлень
      max_msgs_per_subject: 100_000, // 100К на subject
      max_bytes: 100 * 1024 * 1024, // 100MB
      max_age: this.msToNs(this.rpcTimeoutMs), // ← 3 хвилини максимум
      max_msg_size: 5 * 1024 * 1024, // 5MB (менше для RPC)
      duplicate_window: 30 * 1_000_000_000, // 30 секунд
      discard: DiscardPolicy.Old,

      // Швидкість для RPC
      allow_direct: true,
      allow_rollup_hdrs: false, // Вимкнути для швидкості
      compression: StoreCompression.None,
      sealed: false,
      no_ack: false,
      deny_delete: false,
      deny_purge: false,
      max_consumers: 50, // Менше для RPC
      first_seq: 0,
      mirror_direct: false,
      discard_new_per_subject: false,
    };

    return this.getJetStreamManager().pipe(
      switchMap((jsm) => this.createOrUpdateStream(jsm, commandCfg)),
    );
  }

  protected override setupEventHandlers(): Observable<void> {
    if (this.getRegisteredPatterns().events.length === 0) {
      this.logDebug('No EventPattern found – skip event consumer');
      return of(void 0);
    }
    return this.createConsumer(this.buildConsumerCfg(JetstreamMessageType.Event)).pipe(
      switchMap((c) => this.pullLoop(c, false)),
    );
  }

  protected override setupMessageHandlers(): Observable<void> {
    if (this.getRegisteredPatterns().messages.length === 0) {
      this.logDebug('No MessagePattern found – skip command consumer');
      return of(void 0);
    }
    return this.createConsumer(this.buildConsumerCfg(JetstreamMessageType.Command)).pipe(
      switchMap((c) => this.pullLoop(c, true)),
    );
  }

  /* ================================================================
   *  PULL LOOP IMPLEMENTATION
   * ================================================================ */

  /**
   * Оптимізований pull loop без затримок
   */
  private pullLoop(consumer: Consumer, isRpc: boolean): Observable<void> {
    const tag = isRpc ? 'RPC' : 'EVENT';

    return defer(async () => {
      const info = await consumer.info();
      return info.config.durable_name;
    }).pipe(
      switchMap((durableName) => {
        this.logDebug(`Start pull loop <${tag}> for durable ${durableName}`);

        // Рекурсивний цикл без затримок
        const continuousLoop = (): Observable<void> => {
          return this.fetchBatch(consumer, isRpc).pipe(
            switchMap(() => continuousLoop()), // ← Негайно продовжуємо
          );
        };

        return continuousLoop();
      }),
      catchError((err) => {
        this.logger.error(`Pull loop <${tag}> error: ${err.message}`);
        // При помилці - короткий таймаут і перезапуск
        return timer(1000).pipe(switchMap(() => this.pullLoop(consumer, isRpc)));
      }),
    );
  }

  /**
   * Швидкий fetch одного повідомлення
   */
  private fetchBatch(consumer: Consumer, isRpc: boolean): Observable<void> {
    return defer(() => {
      return from(consumer.next({ expires: this.fetchExpires }));
    }).pipe(
      switchMap((msg: JsMsg | null) => {
        if (!msg) return of(void 0);

        return this.processJsMsg(msg, isRpc);
      }),
      catchError((err) => {
        if (err.message?.includes('timeout') || err.message?.includes('408')) {
          this.logDebug('Fetch timeout - continuing');
          return of(void 0);
        }
        this.logger.error(`Fetch error: ${err.message}`);
        return of(void 0);
      }),
      map(() => void 0),
    );
  }

  /**
   * Обробка повідомлення з дедуплікацією
   */
  private processJsMsg(msg: JsMsg, isRpc: boolean): Observable<void> {
    const msgId = `${msg.subject}-${msg.seq}`;

    if (this.processingMessages.has(msgId)) {
      this.logDebug(`Duplicate message skipped: ${msgId}`);
      msg.ack();
      return of(void 0);
    }

    return defer(() => {
      this.processingMessages.add(msgId);

      const handler = this.getHandlerByPattern(msg.subject);
      if (!handler) {
        this.logDebug(`No handler for subject ${msg.subject}`);
        msg.term();
        this.processingMessages.delete(msgId);
        return of(void 0);
      }

      const data = this.codec.decode(msg.data);
      const ctx = {
        subject: msg.subject,
        headers: msg.headers,
        // Додаємо метод для довгої обробки
        extendProcessingTime: () => {
          this.logDebug(`Extending processing time for ${msgId}`);
          msg.working();
        },
      };
      const result$ = this.handleAsyncResult(handler(data, ctx));
      const replyTo = msg.headers?.get(JetstreamHeaders.ReplyTo);

      if (isRpc && replyTo) {
        return result$.pipe(
          switchMap((response) => {
            this.publishResponse(replyTo, response);
            return of(void 0);
          }),
          catchError((err) => {
            this.publishErrorResponse(replyTo, err);
            return of(void 0);
          }),
          finalize(() => {
            msg.ack();
            this.processingMessages.delete(msgId);
          }),
        );
      }

      return result$.pipe(
        finalize(() => {
          msg.ack();
          this.processingMessages.delete(msgId);
        }),
        catchError((err) => {
          this.logger.error(`Handler error (${msg.subject}): ${err.message}`);
          msg.nak();
          this.processingMessages.delete(msgId);
          return of(void 0);
        }),
      );
    });
  }

  /* ================================================================
   *  CONSUMER CONFIGURATION
   * ================================================================ */

  /**
   * Різні consumer конфігурації для events та commands
   */
  private buildConsumerCfg(t: JetstreamMessageType): JetstreamConsumerSetup {
    const { serviceName } = this.options;
    const isRpc = t === JetstreamMessageType.Command;

    const streamName = isRpc
      ? `${getStreamName(serviceName)}-commands`
      : `${getStreamName(serviceName)}-events`;

    return {
      stream: streamName,
      config: {
        durable_name: getJetstreamDurableName(serviceName, t),
        filter_subject: getJetStreamFilterSubject(serviceName, t),
        deliver_policy: DeliverPolicy.All,
        replay_policy: ReplayPolicy.Instant,
        ack_policy: AckPolicy.Explicit,

        // Різні таймаути для RPC та Events
        ack_wait: this.msToNs(isRpc ? this.rpcTimeoutMs : this.eventTimeoutMs),
        max_deliver: isRpc ? 1 : 3, // RPC - один раз, Events - до 3 разів
        max_ack_pending: isRpc ? 5 : this.maxAckPending, // RPC - менше паралельності
      },
    };
  }

  private msToNs(ms: number): number {
    return ms * 1_000_000;
  }
}
