import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import { Logger, OnModuleInit } from '@nestjs/common';
import { IClientProviders } from './types';
import { firstValueFrom, from, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { createInbox, headers, JSONCodec, NatsConnection, PubAck } from 'nats';
import { JetStreamKind } from '../enum';
import { v7 } from 'uuid';
import { JetstreamHeaders } from '@nestkit-x/jetstream-transport';

export class JetstreamClientProxy extends ClientProxy implements OnModuleInit {
  private readonly logger = new Logger(JetstreamClientProxy.name);
  private readonly destroy$ = new Subject<void>();
  private readonly inbox: string = createInbox();
  private readonly codec = JSONCodec();

  private isConnected = false;

  public constructor(private readonly providers: IClientProviders) {
    super();

    this.logger.debug(`Microservice client created (inbox: ${this.inbox})`);
  }

  public onModuleInit(): void {
    void this.connect();
  }

  public async close(): Promise<void> {
    return firstValueFrom(
      this.providers.connectionProvider.nc.pipe(switchMap((nc) => from(nc.close()))),
    );
  }

  public async connect(): Promise<NatsConnection> {
    if (this.isConnected) {
      return firstValueFrom(this.providers.connectionProvider.nc);
    }

    this.providers.connectionProvider.nc
      .pipe(
        tap((nc) => {
          // ✅ Підписка спрацює при кожному reconnect автоматично
          if (!nc.isClosed() && !nc.isDraining()) {
            this.setupInboxSubscription(nc);
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        error: (err) => {
          this.logger.error('Connection stream error:', err);
          this.isConnected = false;
        },
      });

    this.isConnected = true;

    return firstValueFrom(this.providers.connectionProvider.nc);
  }

  public override unwrap<T = NatsConnection>(): T {
    return this.providers.connectionProvider.unwrap as T;
  }

  protected async dispatchEvent<T = PubAck>(packet: ReadPacket<T>): Promise<T> {
    const subject = this.buildSubject(JetStreamKind.Event, packet.pattern);
    const connection = await this.connect();
    const messageId = v7();

    const hdrs = headers();

    hdrs.set(JetstreamHeaders.MessageId, messageId);
    hdrs.set(JetstreamHeaders.Subject, subject);

    this.logger.verbose(`Event sent: ${subject} (${messageId})`);

    try {
      const result = (await connection
        .jetstream()
        .publish(subject, this.codec.encode(packet.data), { headers: hdrs })) as T;

      return result;
    } catch (error) {
      this.logger.error('Error sending event:', error);

      throw error;
    }
  }

  protected publish<T = unknown>(
    packet: ReadPacket<T>,
    callback: (packet: WritePacket) => void,
  ): () => void {
    this.logger.log('publish() called', packet);

    // Повертаємо функцію-cleanup
    return () => {
      this.logger.log('cleanup function called');
    };
  }

  private setupInboxSubscription(nc: NatsConnection): void {
    this.logger.log(`Subscribing to inbox: ${this.inbox}`);

    nc.subscribe(this.inbox, {
      callback: (error, msg) => {
        if (error) {
          this.logger.error('Inbox error:', error);
          return;
        }

        if (!msg.data.length) {
          this.logger.warn('Received empty message');
          return;
        }

        // TODO: routeReply(msg)
        this.logger.debug('Received reply', msg);
      },
    });
  }

  private buildSubject(kind: JetStreamKind, pattern: string): string {
    return `${this.providers.options.name}.${kind}.${pattern}`;
  }
}
