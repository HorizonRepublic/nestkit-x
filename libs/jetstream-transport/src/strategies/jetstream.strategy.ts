import {
  AckPolicy,
  Codec,
  connect as natsConnect,
  ConnectionOptions,
  Consumer,
  DeliverPolicy,
  DiscardPolicy,
  JetStreamManager,
  JsMsg,
  JSONCodec,
  NatsConnection,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
  StoreCompression,
  StreamConfig,
} from 'nats';
import {
  CustomTransportStrategy,
  MessageHandler,
  Server,
  TransportId,
} from '@nestjs/microservices';
import {
  catchError,
  defer,
  EMPTY,
  finalize,
  from,
  map,
  merge,
  Observable,
  of,
  repeat,
  shareReplay,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs';
import { JetstreamEventBus } from '../jetstream.event-bus';
import { JetStreamContext } from '../jetstream.context';
import { IJetstreamEventsMap } from '../types/events-map.interface';
import {
  IJetstreamTransportOptions,
  JetstreamConsumerSetup,
  JetstreamEvent,
  JetstreamHeaders,
  JetstreamMessageType,
} from '@nestkit-x/jetstream-transport';
import { getJetstreamDurableName, getJetStreamFilterSubject, getStreamName } from '../helpers';
import { Logger } from '@nestjs/common';

/**
 * Abstract base class for implementing NATS JetStream transport strategies in NestJS microservices.
 * Provides core functionality for managing NATS connections and JetStream interactions.
 */
export class JetstreamStrategy
  extends Server<IJetstreamEventsMap>
  implements CustomTransportStrategy
{
  public override readonly transportId: TransportId = Symbol('NATS_JETSTREAM_TRANSPORT');
  protected override logger = new Logger(JetstreamStrategy.name);

  protected readonly patternHandlers = new Map<
    string,
    {
      handler: MessageHandler<any, any, any>;
      isEvent: boolean;
    }
  >();

  protected readonly eventBus = new JetstreamEventBus();
  protected readonly codec: Codec<any> = JSONCodec();

  protected connectionReference: NatsConnection | null = null;
  protected jetStreamManager$: Observable<JetStreamManager> | null = null;
  protected natsConnection$: Observable<NatsConnection> | null = null;
  private readonly rpcTimeoutMs = 180_000; // 3 min
  private readonly eventTimeoutMs = 60_000; // 1 min
  private readonly fetchExpiresMs = 30_000; // pull timeout
  private readonly maxAckPendingEvents = 50; // паралельність для івентів
  private readonly maxAckPendingRpc = 5; // паралельність RPC

  public constructor(protected readonly options: IJetstreamTransportOptions) {
    super();
    this.setupErrorLogging();
  }

  /**
   * Safe debug logging helper
   */
  protected logDebug(message: string, context?: any): void {
    if (this.logger.debug) {
      this.logger.debug(message, context);
    }
  }

  private setupErrorLogging(): void {
    this.eventBus.on(JetstreamEvent.Error, (error: unknown) => {
      this.logger.error(error);
    });
  }

  public override getHandlerByPattern(subject: string): MessageHandler<any, any, any> | null {
    const shortPattern = this.denormalizePattern(subject);
    const baseHandler = this.messageHandlers.get(shortPattern);
    if (baseHandler) {
      return baseHandler;
    }

    const direct = this.patternHandlers.get(subject);
    if (direct) {
      return direct.handler;
    }

    return null;
  }

  private denormalizePattern(subject: string): string {
    const serviceName = this.options.serviceName;

    if (subject.startsWith(`${serviceName}.cmd.`)) {
      return subject.replace(`${serviceName}.cmd.`, '');
    }

    if (subject.startsWith(`${serviceName}.event.`)) {
      return subject.replace(`${serviceName}.event.`, '');
    }

    return subject;
  }

  protected getRegisteredPatterns(): { events: string[]; messages: string[] } {
    const events: string[] = [];
    const messages: string[] = [];

    for (const [pattern, handler] of this.messageHandlers) {
      if (handler.isEventHandler) {
        events.push(pattern);
      } else {
        messages.push(pattern);
      }
    }

    return { events, messages };
  }

  /**
   * Creates or updates a JetStream stream
   */
  protected createOrUpdateStream(jsm: JetStreamManager, config: StreamConfig): Observable<void> {
    return defer(() => from(jsm.streams.info(config.name))).pipe(
      switchMap((info: any) => {
        this.logger.log(`Updating existing stream: ${config.name}`, {
          currentSubjects: info.config.subjects,
          newSubjects: config.subjects,
        });

        return from(jsm.streams.update(config.name, { subjects: config.subjects }));
      }),
      catchError(() => {
        this.logger.log(`Creating new stream: ${config.name}`, { subjects: config.subjects });

        return from(jsm.streams.add(config));
      }),
      tap(() => {
        this.logger.log(`Stream ${config.name} ready`, {
          subjects: config.subjects,
          storage: config.storage,
          retention: config.retention,
        });
      }),
      map(() => void 0),
    );
  }

  /**
   * Creates a JetStream consumer with the specified configuration
   */
  protected createConsumer(config: JetstreamConsumerSetup): Observable<Consumer> {
    return this.getJetStreamManager().pipe(
      switchMap((jsm) => {
        this.logDebug(`Creating consumer: ${config.config.durable_name}`);

        return from(jsm.consumers.add(config.stream, config.config)).pipe(
          catchError((error) => {
            if (error.code === '400' && error.api_error?.err_code === 10148) {
              this.logDebug(
                `Consumer ${config.config.durable_name} already exists, using existing`,
              );
              return of(null);
            }
            throw error;
          }),
        );
      }),
      switchMap(() =>
        from(
          this.connectionReference!.jetstream().consumers.get(
            config.stream,
            config.config.durable_name!,
          ),
        ),
      ),
      tap(() => {
        this.logger.log(`Consumer ready: ${config.config.durable_name}`);
      }),
    );
  }

  /**
   * Processes a single message
   */
  protected processMessage(message: JsMsg, isRpc: boolean): Observable<void> {
    return defer(() => {
      const handler = this.getHandlerByPattern(message.subject);

      if (!handler) {
        this.logDebug(`No handler found for subject: ${message.subject}`);
        message.ack();
        return of(void 0);
      }

      this.logDebug(`Processing ${isRpc ? 'RPC' : 'event'} message`, {
        subject: message.subject,
        hasReplyTo: !!message.headers?.get(JetstreamHeaders.ReplyTo),
      });

      return isRpc
        ? this.handleRpcMessage(message, handler)
        : this.handleEventMessage(message, handler);
    });
  }

  /**
   * Handles event messages (fire-and-forget)
   */
  protected handleEventMessage(message: JsMsg, handler: any): Observable<void> {
    return defer(() => {
      const data = this.decodeMessageData(message);
      const ctx = new JetStreamContext([message]);

      try {
        const result = handler(data, ctx);
        return this.handleAsyncResult(result).pipe(
          tap(() => {
            this.logDebug(`Event processed successfully`, {
              subject: message.subject,
            });
            message.ack();
          }),
          catchError((error) => {
            this.logger.error(`Event handler error for ${message.subject}: ${error.message}`);
            message.nak();
            return of(void 0);
          }),
        );
      } catch (error) {
        this.logger.error(
          `Event handler error for ${message.subject}: ${(error as Error).message}`,
        );
        message.nak();
        return of(void 0);
      }
    });
  }

  /**
   * Handles RPC messages (request-response)
   */
  protected handleRpcMessage(message: JsMsg, handler: any): Observable<void> {
    return defer(() => {
      const data = this.decodeMessageData(message);
      const ctx = new JetStreamContext([message]);
      const replyTo = message.headers?.get(JetstreamHeaders.ReplyTo);

      try {
        const result = handler(data, ctx);
        return this.handleAsyncResult(result).pipe(
          tap((response) => {
            this.logDebug(`RPC processed successfully`, {
              subject: message.subject,
              hasResponse: response !== undefined,
            });
            if (replyTo) {
              this.publishResponse(replyTo, response);
            }
            message.ack();
          }),
          catchError((error) => {
            this.logger.error(`RPC handler error for ${message.subject}: ${error.message}`);
            if (replyTo) {
              this.publishErrorResponse(replyTo, error);
            }
            message.nak();
            return of(void 0);
          }),
        );
      } catch (error) {
        this.logger.error(`RPC handler error for ${message.subject}: ${(error as Error).message}`);
        if (replyTo) {
          this.publishErrorResponse(replyTo, error);
        }
        message.nak();
        return of(void 0);
      }
    });
  }

  /**
   * Decodes message data using the configured codec
   */
  protected decodeMessageData(message: JsMsg): any {
    try {
      return this.codec.decode(message.data);
    } catch (error) {
      this.logger.error(`Failed to decode message data: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Handles async results from message handlers
   */
  protected handleAsyncResult(result: Promise<any>): Observable<any> {
    return from(result).pipe(
      switchMap((resolvedValue: any) => {
        if (resolvedValue && typeof resolvedValue.subscribe === 'function') {
          return resolvedValue as Observable<any>;
        }
        return of(resolvedValue);
      }),
    );
  }

  /**
   * Publishes a successful response to the reply subject
   */
  protected publishResponse(replyTo: string, response: any): void {
    try {
      this.connectionReference!.publish(replyTo, this.codec.encode(response));
    } catch (error) {
      this.logger.error(`Failed to serialize response: ${(error as Error).message}`);
      this.publishErrorResponse(replyTo, new Error('Response serialization failed'));
    }
  }

  /**
   * Publishes an error response to the reply subject
   */
  protected publishErrorResponse(replyTo: string, error: any): void {
    const errorResponse = {
      error: error instanceof Error ? error.message : String(error),
    };
    this.connectionReference!.publish(replyTo, this.codec.encode(errorResponse));
  }

  protected getNatsConnection(): Observable<NatsConnection> {
    if (this.natsConnection$) return this.natsConnection$;

    const opts: ConnectionOptions = {
      ...this.options.connectionOptions,
      name: this.options.serviceName,
    };

    this.eventBus.emit(JetstreamEvent.Connecting);

    const natsConnector = defer(() => from(natsConnect(opts)));

    this.natsConnection$ = natsConnector.pipe(
      tap((connection) => {
        this.connectionReference = connection;
        this.eventBus.emit(JetstreamEvent.Connected, connection);
      }),
      catchError((error) => {
        this.eventBus.emit(JetstreamEvent.Error, error);
        throw error;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    return this.natsConnection$;
  }

  protected getJetStreamManager(): Observable<JetStreamManager> {
    if (this.jetStreamManager$) {
      return this.jetStreamManager$;
    }

    this.jetStreamManager$ = this.getNatsConnection().pipe(
      switchMap((connection) =>
        defer(() => from(connection.jetstreamManager(this.options.jetstreamOptions))),
      ),
      tap(() => {
        this.eventBus.emit(JetstreamEvent.JetStreamAttached);
      }),
      catchError((error) => {
        this.eventBus.emit(JetstreamEvent.Error, error);
        throw error;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    return this.jetStreamManager$;
  }

  protected connect(): Observable<{
    connection: NatsConnection;
    jetStreamManager: JetStreamManager;
  }> {
    return this.getNatsConnection().pipe(
      switchMap((connection) =>
        this.getJetStreamManager().pipe(
          map((jetStreamManager) => ({ connection, jetStreamManager })),
        ),
      ),
      catchError((error) => {
        this.eventBus.emit(JetstreamEvent.Error, error);
        throw error;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  public close(): Observable<void> {
    if (!this.natsConnection$) return EMPTY;

    const drainAndClose = (nc: NatsConnection) =>
      defer(() => from(nc.drain())).pipe(
        switchMap(() => from(nc.close())),
        tap(() => {
          this.eventBus.emit(JetstreamEvent.Disconnected);
        }),
      );

    const handleError = (error: any) => {
      this.eventBus.emit(JetstreamEvent.Error, error);
      return EMPTY;
    };

    const cleanup = () => {
      this.natsConnection$ = null;
      this.jetStreamManager$ = null;
      this.connectionReference = null;
      this.eventBus.destroy();
      this.patternHandlers.clear();
    };

    return this.natsConnection$.pipe(
      switchMap((nc) => (nc.isClosed() ? EMPTY : drainAndClose(nc))),
      catchError(handleError),
      finalize(cleanup),
      take(1),
    );
  }

  public listen(callback: () => void): void {
    callback();

    const flow$ = this.connect().pipe(
      take(1),
      tap(() => {
        const { events, messages } = this.getRegisteredPatterns();
        this.logger.log(`Events: ${events.join(', ') || 'none'}`);
        this.logger.log(`Messages: ${messages.join(', ') || 'none'}`);
      }),
      switchMap(() => merge(this.setupCommandStream(), this.setupEventStream())),
      switchMap(() => merge(this.setupEventHandlers(), this.setupMessageHandlers())),
      catchError((err) => {
        this.eventBus.emit(JetstreamEvent.Error, err);
        throw err;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    flow$.subscribe({
      error: (err) => {
        this.eventBus.emit(JetstreamEvent.Error, err);
      },
    });
  }

  public on<E extends keyof IJetstreamEventsMap>(event: E, callback: IJetstreamEventsMap[E]): any {
    return this.eventBus.on(event as JetstreamEvent, callback as any);
  }

  public unwrap<T = NatsConnection | null>(): T {
    return this.connectionReference as T;
  }

  public override get status(): Observable<JetstreamEvent> {
    return this.eventBus.status;
  }

  protected setupEventStream(): Observable<void> {
    const { serviceName } = this.options;

    const cfg: StreamConfig = {
      /* технічні прапорці — залишив як у тебе */
      deny_delete: false,
      deny_purge: false,
      discard_new_per_subject: false,
      first_seq: 0,
      max_consumers: 100,
      max_msg_size: 10 * 1024 * 1024, // 10 MB
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
      max_msgs: 50_000_000, // 50 M
      max_bytes: 5 * 1024 ** 3, // 5 GB
      max_age: 7 * 24 * 60 * 60 * 1e9, // 7 днів
      duplicate_window: 2 * 60 * 1e9, // 2 хв

      /* поведінка дискарду й I/O */
      discard: DiscardPolicy.Old,
      allow_direct: true,
      allow_rollup_hdrs: true,
      compression: StoreCompression.None,
    };

    return this.getJetStreamManager().pipe(switchMap((jsm) => this.createOrUpdateStream(jsm, cfg)));
  }

  protected setupCommandStream(): Observable<void> {
    const { serviceName } = this.options;

    const cfg: StreamConfig = {
      deny_delete: false,
      deny_purge: false,
      discard_new_per_subject: false,
      first_seq: 0,
      max_consumers: 50,
      max_msg_size: 5 * 1024 * 1024, // 5 MB
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
      max_msgs: 1_000_000, // 1 M
      max_bytes: 100 * 1024 ** 2, // 100 MB
      max_age: this.msToNs(this.rpcTimeoutMs), // 3 хв
      duplicate_window: 30 * 1e9, // 30 сек

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

  protected setupEventHandlers(): Observable<void> {
    if (this.getRegisteredPatterns().events.length === 0) return of(void 0);

    return this.createConsumer(this.consumerCfg(JetstreamMessageType.Event)).pipe(
      switchMap((c) => this.pullLoop(c, false)),
    );
  }

  protected setupMessageHandlers(): Observable<void> {
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
      switchMap(() =>
        defer(() => this.fetchAndProcess(consumer, isRpc)).pipe(
          repeat(),
          map(() => void 0), // Явно повертаємо void
        ),
      ),
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
