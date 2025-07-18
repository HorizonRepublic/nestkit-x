import { Codec, JSONCodec, NatsConnection } from 'nats';
import {
  CustomTransportStrategy,
  MessageHandler,
  Server,
  TransportId,
} from '@nestjs/microservices';
import {
  catchError,
  combineLatest,
  finalize,
  Observable,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { JsEventBus } from './registries/js-event.bus';
import { IJetstreamEventsMap } from './types/events-map.interface';
import { IJetstreamTransportOptions, JetstreamEvent } from './index';
import { Logger } from '@nestjs/common';
import { JsConnectionManager } from './managers/js.connection-manager';
import { JetStreamStreamManager } from './managers/js.stream-manager';
import { JsConsumerManager } from './managers/js.consumer-manager';
import { JsMsgManager } from './managers/js.msg-manager';
import { JsPatternRegistry } from './registries/js.pattern-registry';
import { JsConsumerSupervisor } from './managers/js.consumer-supervisor';

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

  // todo: allow different codecs
  private readonly codec: Codec<any> = JSONCodec();
  private readonly fetchExpiresMs = 5_000;
  private readonly connectionManager: JsConnectionManager;
  private readonly eventBus: JsEventBus;
  private readonly streamManager: JetStreamStreamManager;
  private readonly consumerManager: JsConsumerManager;
  private readonly msgManager: JsMsgManager;
  private readonly patterns: JsPatternRegistry;
  private readonly supervisor: JsConsumerSupervisor;

  private sub?: Subscription;

  public constructor(protected readonly options: IJetstreamTransportOptions) {
    super();

    this.eventBus = new JsEventBus();

    this.connectionManager = new JsConnectionManager(this.options, this.eventBus);

    this.streamManager = new JetStreamStreamManager(
      this.connectionManager.getJetStreamManager(),
      this.options,
      this.logger,
    );

    this.consumerManager = new JsConsumerManager(
      this.connectionManager.getJetStreamManager(),
      this.options,
      this.logger,
    );

    this.patterns = new JsPatternRegistry(this.options.serviceName, this.messageHandlers);

    this.msgManager = new JsMsgManager(
      this.connectionManager.getNatsConnection(),
      this.codec,
      this.logger,
      this.eventBus,
      (subj) => this.patterns.getHandler(subj),
    );

    this.supervisor = new JsConsumerSupervisor(
      this.consumerManager,
      this.streamManager,
      this.connectionManager.getNatsConnection(),
      this.fetchExpiresMs,
      this.logger,
      this.msgManager,
    );
  }

  public override getHandlerByPattern(subject: string): MessageHandler | null {
    return this.patterns.getHandler(subject);
  }

  public close(): Observable<void> {
    this.sub?.unsubscribe();

    return this.connectionManager.close().pipe(
      finalize(() => {
        this.eventBus.destroy();
      }),
    );
  }

  public listen(done: () => void): void {
    if (this.sub && !this.sub.closed) return; // guard від повторного listen

    this.sub = combineLatest([
      this.connectionManager.getNatsConnection(),
      this.connectionManager.getJetStreamManager(),
    ])
      .pipe(
        take(1),
        switchMap(() => this.streamManager.ensureAll()),
        tap(done),
        switchMap(() => {
          const cache = this.patterns.list(); // кеш — один раз
          return this.supervisor.run(cache.events.length > 0, cache.messages.length > 0);
        }),
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
}
