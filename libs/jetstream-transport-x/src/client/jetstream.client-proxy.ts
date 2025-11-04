import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { IClientProviders } from './types';
import { firstValueFrom, Subject, takeUntil, tap } from 'rxjs';
import { createInbox, NatsConnection } from 'nats';

export class JetstreamClientProxy extends ClientProxy {
  private readonly logger = new Logger(JetstreamClientProxy.name);

  private readonly destroy$ = new Subject<void>();
  private readonly inbox: string = createInbox();

  private isConnected = false;

  public constructor(private readonly providers: IClientProviders) {
    super();

    this.logger.debug(`Microservice client created (inbox: ${this.inbox})`);
  }

  public async close(): Promise<void> {
    this.logger.log('close() called');
    return Promise.resolve();
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

  public unwrap<T = unknown>(): T {
    this.logger.log('unwrap() called');
    return undefined as T;
  }

  protected async dispatchEvent<T = unknown>(packet: ReadPacket<T>): Promise<T> {
    this.logger.log('dispatchEvent() called', packet);
    return undefined as T;
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
}
