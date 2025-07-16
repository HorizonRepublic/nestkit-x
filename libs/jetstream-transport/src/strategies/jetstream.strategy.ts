import { MessageHandler, Server, TransportId } from '@nestjs/microservices';
import { CustomTransportStrategy } from '@nestjs/microservices/interfaces/custom-transport-strategy.interface';
import { Codec, connect as natsConnect, JetStreamManager, JSONCodec, NatsConnection } from 'nats';
import {
  catchError,
  defer,
  EMPTY,
  finalize,
  from,
  map,
  merge,
  Observable,
  shareReplay,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';

import { IJetstreamTransportOptions } from '../types/jetstream-transport.options';
import { AnyCallback, AnyCallbackResult } from '../types/callback.types';
import { IJetstreamEventsMap } from '../types/events-map.interface';
import { JetstreamEventBus } from '../jetstream.event-bus';
import { JetstreamEvent } from '@nestkit-x/jetstream-transport';
import { ConnectionOptions } from 'nats/lib/src/nats-base-client';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

/**
 * Abstract base class for implementing NATS JetStream transport strategies in NestJS microservices.
 * Provides core functionality for managing NATS connections and JetStream interactions.
 */
export abstract class JetstreamStrategy
  extends Server<IJetstreamEventsMap>
  implements CustomTransportStrategy
{
  public override readonly transportId: TransportId = Symbol('NATS_JETSTREAM_TRANSPORT');

  // FIX: Store proper MessageHandler types
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

  public constructor(protected readonly options: IJetstreamTransportOptions) {
    super();
    this.setupErrorLogging();
  }

  private setupErrorLogging(): void {
    this.eventBus.on(JetstreamEvent.Error, (error: unknown) => {
      this.logger.error(error);
    });
  }

  // // FIX: Properly type callback parameter
  // public override addHandler(
  //   pattern: string,
  //   callback: MessageHandler<any, any, any>,
  //   isEventHandler?: boolean,
  // ): void {
  //
  //   // Нормалізуємо паттерн: додаємо префікс якщо його немає
  //   const normalizedPattern = this.normalizePatternMyVersion(pattern, isEventHandler || false);
  //
  //   this.patternHandlers.set(normalizedPattern, {
  //     handler: callback,
  //     isEvent: isEventHandler || false,
  //   });
  //   const type = isEventHandler ? 'EventPattern' : 'MessagePattern';
  //
  //   this.logger.log(`Map ${type}: "${pattern}" -> "${normalizedPattern}"`);
  //
  //   // Викликаємо parent з нормалізованим паттерном
  //   super.addHandler(normalizedPattern, callback, isEventHandler);
  // }

  private normalizePatternMyVersion(pattern: string, isEvent: boolean): string {
    const prefix = `${this.options.serviceName}.${isEvent ? 'event' : 'cmd'}.`;

    // Якщо паттерн вже має правильний префікс - залишаємо як є
    if (pattern.startsWith(prefix)) {
      return pattern;
    }

    // Якщо паттерн має інший serviceName - це помилка конфігурації
    if (pattern.includes('.cmd.') || pattern.includes('.event.')) {
      throw new RuntimeException(
        `Cross-service pattern "${pattern}" is not allowed in service "${this.options.serviceName}".`,
      );
    }

    // Додаємо префікс для локальних паттернів
    return `${prefix}${pattern}`;
  }

  // FIX: Return proper type or null
  public override getHandlerByPattern(subject: string): MessageHandler<any, any, any> | null {
    console.log('🔍 Looking for handler:', {
      subject,
      messageHandlers: Array.from(this.messageHandlers.keys()),
      patternHandlers: Array.from(this.patternHandlers.keys()),
    });

    // ✅ ОБРІЗАЄМО префікс з сабджекта
    const shortPattern = this.denormalizePattern(subject);
    console.log('✂️ Denormalized pattern:', { subject, shortPattern });

    // ✅ Шукаємо за коротким паттерном
    const baseHandler = this.messageHandlers.get(shortPattern);
    if (baseHandler) {
      console.log('✅ Found in messageHandlers:', shortPattern);
      return baseHandler;
    }

    // Якщо не знайшли - шукаємо в patternHandlers
    const direct = this.patternHandlers.get(subject);
    if (direct) {
      console.log('✅ Found in patternHandlers:', subject);
      return direct.handler;
    }

    console.log('❌ No handler found for subject:', subject);
    return null;
  }

  // ✅ Додаємо метод для зворотного перетворення
  private denormalizePattern(subject: string): string {
    const serviceName = this.options.serviceName;

    // test-service.cmd.test-cmd -> test-cmd
    if (subject.startsWith(`${serviceName}.cmd.`)) {
      return subject.replace(`${serviceName}.cmd.`, '');
    }

    // test-service.event.test-event -> test-event
    if (subject.startsWith(`${serviceName}.event.`)) {
      return subject.replace(`${serviceName}.event.`, '');
    }

    // Якщо не знайшли префікс - повертаємо як є
    return subject;
  }

  protected getRegisteredPatterns(): { events: string[]; messages: string[] } {
    const events: string[] = [];
    const messages: string[] = [];

    console.log('📋 Getting registered patterns from messageHandlers:', {
      messageHandlers: Array.from(this.messageHandlers.keys()),
      patternHandlers: Array.from(this.patternHandlers.keys()),
    });

    // ✅ Читаємо з базового messageHandlers (оригінальні паттерни)
    for (const [pattern, handler] of this.messageHandlers) {
      if (handler.isEventHandler) {
        events.push(pattern);
      } else {
        messages.push(pattern);
      }
    }

    console.log('📋 Registered patterns result:', { events, messages });

    return { events, messages };
  }

  private matchWildcard(pattern: string, subject: string): boolean {
    const regex = pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]*').replace(/>/g, '.*');
    return new RegExp(`^${regex}$`).test(subject);
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

  public override close(): Observable<void> {
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

  public override listen(cb: AnyCallback): AnyCallbackResult {
    // ✅ Викликаємо callback одразу
    const callbackResult = cb();

    const flow$ = this.connect().pipe(
      take(1),
      tap(() => {
        const { events, messages } = this.getRegisteredPatterns();
        this.logger.log(`📋 Events: ${events.join(', ') || 'none'}`);
        this.logger.log(`📋 Messages: ${messages.join(', ') || 'none'}`);
      }),
      switchMap(() => this.setupStream()),
      // ✅ Запускаємо обоє consumer'ів паралельно
      switchMap(() => merge(this.setupEventHandlers(), this.setupMessageHandlers())),
      catchError((err) => {
        this.eventBus.emit(JetstreamEvent.Error, err);
        throw err;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    // ✅ Підписуємося одразу
    flow$.subscribe({
      error: (err) => {
        this.eventBus.emit(JetstreamEvent.Error, err);
      },
    });

    // ✅ Повертаємо результат callback'у
    return callbackResult;
  }

  public override on<E extends keyof IJetstreamEventsMap, CB extends IJetstreamEventsMap[E]>(
    event: E,
    callback: CB,
  ): Subscription {
    return this.eventBus.on(event as JetstreamEvent, callback as any);
  }

  public override unwrap<T = NatsConnection | null>(): T {
    return this.connectionReference as T;
  }

  public override get status(): Observable<JetstreamEvent> {
    return this.eventBus.status;
  }

  protected abstract setupStream(): Observable<void>;

  protected abstract setupEventHandlers(): Observable<void>;

  protected abstract setupMessageHandlers(): Observable<void>;
}
