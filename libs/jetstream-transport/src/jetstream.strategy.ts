import {
  AckPolicy,
  Codec,
  Consumer,
  DeliverPolicy,
  JetStreamManager,
  JsMsg,
  JSONCodec,
  NatsConnection,
  ReplayPolicy,
  StreamConfig,
} from 'nats';
import { CustomTransportStrategy, MessageHandler, Server, TransportId } from '@nestjs/microservices';
import {
  catchError,
  combineLatest,
  defer,
  EMPTY,
  finalize,
  from,
  map,
  merge,
  Observable,
  of,
  repeat,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs';
import { JsEventBus } from './js-event.bus';
import { IJetstreamEventsMap } from './types/events-map.interface';
import {
  IJetstreamTransportOptions,
  JetstreamConsumerSetup,
  JetStreamErrorCodes,
  JetstreamEvent,
  JetstreamHeaders,
} from './index';
import { getJetstreamDurableName, getJetStreamFilterSubject } from './helpers';
import { Logger } from '@nestjs/common';
import { JsConnectionManager } from './managers/js.connection-manager';
import { JetStreamContext } from './jetstream.context';
import { JetStreamStreamManager } from './managers/js.stream-manager';
import { JsKind } from './const/enum';

/**
 * Abstract base class for implementing NATS JetStream transport strategies in NestJS microservices.
 * Provides core functionality for managing NATS connections and JetStream interactions.
 */
export class JetstreamStrategy
  extends Server<IJetstreamEventsMap>
  implements CustomTransportStrategy {
  public override readonly transportId: TransportId = Symbol('NATS_JETSTREAM_TRANSPORT');
  protected override logger = new Logger(JetstreamStrategy.name);

  protected readonly patternHandlers = new Map<
    string,
    { handler: MessageHandler; isEvent: boolean }
  >();

  protected readonly codec: Codec<any> = JSONCodec();

  private readonly rpcTimeoutMs = 180_000; // 3 min
  private readonly eventTimeoutMs = 60_000; // 1 min
  private readonly fetchExpiresMs = 30_000; // pull timeout
  private readonly maxAckPendingEvents = 50; // паралельність для івентів
  private readonly maxAckPendingRpc = 5; // паралельність RPC

  // new
  private readonly connectionManager: JsConnectionManager;
  private readonly eventBus: JsEventBus;
  private readonly streamManager: JetStreamStreamManager;

  public constructor(protected readonly options: IJetstreamTransportOptions) {
    super();

    this.eventBus = new JsEventBus();

    this.connectionManager = new JsConnectionManager(this.options, this.eventBus);

    this.streamManager = new JetStreamStreamManager(
      this.connectionManager.getJetStreamManager(),
      this.options,
      this.logger,
    );
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

    
    const cmdSearchStr = `${serviceName}.${JsKind.Command}.`;
    if (subject.startsWith(cmdSearchStr)) {
      return subject.replace(cmdSearchStr, '');
    }
    
    const eventSearchStr = `${serviceName}.${JsKind.Event}.`;

    if (subject.startsWith(eventSearchStr)) {
      return subject.replace(eventSearchStr, '');
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
    return this.connectionManager.getJetStreamManager().pipe(
      switchMap((jsm) => {
        this.logger.debug(`Creating consumer: ${config.config.durable_name}`);

        return from(jsm.consumers.add(config.stream, config.config)).pipe(
          catchError((error) => {
            if (error.api_error?.err_code === JetStreamErrorCodes.NotFound) {
              this.logger.debug(
                `Consumer ${config.config.durable_name} already exists, using existing`,
              );
              return of(null);
            }
            throw error;
          }),
        );
      }),

      switchMap(() =>
        this.connectionManager
          .getNatsConnection()
          .pipe(
            switchMap((connection) =>
              from(
                connection.jetstream().consumers.get(config.stream, config.config.durable_name!),
              ),
            ),
          ),
      ),
      tap(() => {
        this.logger.log(`Consumer ready: ${config.config.durable_name}`);
      }),
    );
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
  protected publishResponse(replyTo: string, response: any): Observable<void> {
    return this.connectionManager.getNatsConnection().pipe(
      switchMap((connection) => {
        try {
          connection.publish(replyTo, this.codec.encode(response));

          return of(void 0);
        } catch (error) {
          this.logger.error(`Failed to serialize response: ${(error as Error).message}`);
          return this.publishErrorResponse(replyTo, new Error('Response serialization failed'));
        }
      }),
      catchError((error) => {
        this.logger.error(`Failed to publish response: ${(error as Error).message}`);
        return of(void 0);
      }),
    );
  }

  /**
   * Publishes an error response to the reply subject
   */
  protected publishErrorResponse(replyTo: string, error: any): Observable<void> {
    return this.connectionManager.getNatsConnection().pipe(
      switchMap((connection) => {
        const errorResponse = {
          error: error instanceof Error ? error.message : String(error),
        };
        connection.publish(replyTo, this.codec.encode(errorResponse));
        return of(void 0);
      }),
      catchError((publishError) => {
        this.logger.error(`Failed to publish error response: ${(publishError as Error).message}`);
        return of(void 0);
      }),
    );
  }

  public close(): Observable<void> {
    return this.connectionManager.close().pipe(
      finalize(() => {
        this.eventBus.destroy();
        this.patternHandlers.clear();
      }),
    );
  }

  public listen(callback: () => void): void {
    const connection$ = combineLatest([
      this.connectionManager.getNatsConnection(),
      this.connectionManager.getJetStreamManager(),
    ]).pipe(take(1));

    connection$
      .pipe(
        tap(() => {
          const { events, messages } = this.getRegisteredPatterns();
          this.logger.log(`Events: ${events.join(', ') || 'none'}`);
          this.logger.log(`Messages: ${messages.join(', ') || 'none'}`);
        }),
        switchMap(() => this.streamManager.ensureAll()),
        tap(() => {
          const { events, messages } = this.getRegisteredPatterns();

          const flow = (t: JsKind, ack: boolean) =>
            this.createConsumer(this.consumerCfg(t))
              .pipe(switchMap((c) => this.pullLoop(c, ack)));

          merge(
            events.length ? flow(JsKind.Event, false) : EMPTY,
            messages.length ? flow(JsKind.Command, true) : EMPTY,
          ).subscribe({
            error: (err) => this.eventBus.emit(JetstreamEvent.Error, err),
          });
        }),

        finalize(callback),
        catchError((err) => {
          this.eventBus.emit(JetstreamEvent.Error, err);
          throw err;
        }),
      )
      .subscribe();
  }

  public on<E extends keyof IJetstreamEventsMap>(event: E, callback: IJetstreamEventsMap[E]): any {
    return this.eventBus.on(event as JetstreamEvent, callback as any);
  }

  public unwrap<T = NatsConnection | null>(): T {
    return this.connectionManager.getRef() as T;
  }

  public override get status(): Observable<JetstreamEvent> {
    return this.eventBus.status;
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
    const ctx = new JetStreamContext([msg]);

    const result$ = this.handleAsyncResult(handler(data, ctx));
    const replyTo = msg.headers?.get(JetstreamHeaders.ReplyTo);

    if (isRpc && replyTo) {
      return result$.pipe(
        switchMap((resp) => this.publishResponse(replyTo, resp)),
        catchError((err) => this.publishErrorResponse(replyTo, err)),
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

  private consumerCfg(kind: JsKind): JetstreamConsumerSetup {
    const { serviceName } = this.options;
    const isRpc = kind === JsKind.Command;

    return {
      stream: this.streamManager.getStreamName(kind),
      config: {
        durable_name: getJetstreamDurableName(serviceName, kind),
        filter_subject: getJetStreamFilterSubject(serviceName, kind),
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
