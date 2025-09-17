// jetstream.client.ts
import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import {
  catchError,
  firstValueFrom,
  map,
  Observable,
  switchMap,
  take,
  tap,
  throwError,
} from 'rxjs';
import { Codec, createInbox, headers, JSONCodec, Msg, NatsConnection, NatsError } from 'nats';
import { v4 as uuid } from 'uuid';
import { JsConnectionManager } from '../managers/js.connection-manager';
import { JsEventBus } from '../registries/js-event.bus';
import { JetstreamEvent, JetstreamHeaders, JsKind } from '../const/enum';
import { IJetStreamClientOptions } from './types';
import { InternalServerErrorException, Logger } from '@nestjs/common';

/* --------------------------------------------------------------- */

export class JetstreamClient extends ClientProxy {
  private readonly logger = new Logger(JetstreamClient.name);

  /* ---------- infrastructure ---------- */

  private readonly codec: Codec<unknown> = JSONCodec(); // make dynamic later
  private readonly eventBus = new JsEventBus();
  private readonly connectionManager: JsConnectionManager;
  private readonly readyStates = new Set<JetstreamEvent>([
    JetstreamEvent.Connected,
    JetstreamEvent.Reconnected,
    JetstreamEvent.JetStreamAttached,
  ]);
  private isInboxSubscribed = false; // ✅ Додаємо флаг

  /* ---------- shared inbox state ---------- */

  private readonly sharedInbox = createInbox();
  private readonly pending = new Map<string, (p: WritePacket) => void>();

  public constructor(private readonly opts: IJetStreamClientOptions) {
    super();

    this.connectionManager = new JsConnectionManager(opts, this.eventBus);

    this.connectionManager
      .getNatsConnection()
      .pipe(take(1))
      .subscribe((conn) => {
        if (!this.isInboxSubscribed) {
          this.logger.log(`Connected to NATS (shared inbox = ${this.sharedInbox})`);

          conn.subscribe(this.sharedInbox, {
            callback: (error: NatsError | null, msg: Msg) => {
              if (error) {
                this.logger.error(`Inbox subscription error:`, error);

                return;
              }

              if (msg.data.length === 0) {
                this.logger.warn('Received undefined message in inbox');

                return;
              }

              this.routeReply(msg);
            },
          });

          this.isInboxSubscribed = true;
        }
      });
  }

  public async connect(): Promise<NatsConnection> {
    return firstValueFrom(this.connectionManager.getNatsConnection());
  }

  public async close(): Promise<void> {
    await firstValueFrom(this.connectionManager.close());
    this.eventBus.destroy();
  }

  public unwrap<T = NatsConnection | null>(): T {
    return this.connectionManager.getRef() as T;
  }

  /* =============================================================
   *  Events  (fire‑and‑forget)
   * =========================================================== */

  protected dispatchEvent<T = unknown>(packet: ReadPacket): Promise<T> {
    const subj = this.buildSubject(JsKind.Event, packet.pattern);

    const hdrs = headers();
    const messageId = uuid();

    hdrs.set(JetstreamHeaders.MessageId, messageId);
    hdrs.set(JetstreamHeaders.Subject, subj);

    return firstValueFrom(
      this.requireHealthyConnection$().pipe(
        tap((conn) => {
          this.logger.log(`→ [Event] ${subj} (${messageId})`);
          conn.publish(subj, this.codec.encode(packet.data), { headers: hdrs });
        }),
        map(() => undefined as unknown as T),
        catchError((err) =>
          throwError(() => this.toInternalError(err, 'Failed to dispatch JetStream event')),
        ),
      ),
    );
  }

  /* =============================================================
   *  RPC / Commands
   * =========================================================== */

  protected publish(packet: ReadPacket, callback: (p: WritePacket) => void): () => void {
    const subj = this.buildSubject(JsKind.Command, packet.pattern);
    const corrId = uuid();

    this.pending.set(corrId, callback);

    const subscription = this.requireHealthyConnection$().subscribe({
      next: (conn) => {
        const hdrs = headers();

        hdrs.set(JetstreamHeaders.ReplyTo, this.sharedInbox);
        hdrs.set(JetstreamHeaders.CorrelationId, corrId);
        hdrs.set(JetstreamHeaders.MessageId, corrId);
        hdrs.set(JetstreamHeaders.Subject, subj);

        try {
          this.logger.log(`→ [Command] ${subj} (cid: ${corrId})`);
          conn.publish(subj, this.codec.encode(packet.data), { headers: hdrs });
        } catch (err) {
          const error = this.toInternalError(err, 'Failed to publish JetStream command');
          this.pending.delete(corrId);
          callback({ err: error, response: null });
        }
      },
      error: (err) => {
        const error = this.toInternalError(err, 'JetStream command transport unavailable');
        this.pending.delete(corrId);
        callback({ err: error, response: null });
      },
    });

    return () => {
      this.pending.delete(corrId);
      subscription.unsubscribe();
    };
  }

  /* =============================================================
   *  Internal helpers
   * =========================================================== */

  private requireHealthyConnection$(): Observable<NatsConnection> {
    return this.eventBus.status.pipe(
      take(1),
      switchMap((status) => {
        if (!this.readyStates.has(status)) {
          return throwError(() => this.createUnavailableError(status));
        }

        return this.connectionManager.getNatsConnection().pipe(
          take(1),
          catchError((err) => throwError(() => this.createUnavailableError(status, err))),
        );
      }),
    );
  }

  private createUnavailableError(
    status: JetstreamEvent,
    cause?: unknown,
  ): InternalServerErrorException {
    const message = `JetStream transport is unavailable (status: ${status})`;

    if (cause) {
      this.logger.error(message, cause as any);
    } else {
      this.logger.error(message);
    }

    return new InternalServerErrorException(message);
  }

  private toInternalError(
    error: unknown,
    message: string,
  ): InternalServerErrorException {
    if (error instanceof InternalServerErrorException) {
      return error;
    }

    this.logger.error(message, error as any);

    return new InternalServerErrorException(message);
  }

  private routeReply(msg: Msg): void {
    const cid = msg.headers?.get(JetstreamHeaders.CorrelationId);

    this.logger.debug(`← [Reply] Received response (cid: ${cid})`); // ✅ Додаємо debug log

    const handler = cid ? this.pending.get(cid) : undefined;

    if (!handler) {
      this.logger.warn(`No handler found for correlation ID: ${cid}`);
      return;
    }

    try {
      const resp = this.codec.decode(msg.data);

      this.logger.debug(`← [Reply] Decoded response for ${cid}:`, resp);

      handler({ err: null, response: resp });
    } catch (e) {
      this.logger.error(`Failed to decode response for ${cid}:`, e);
      handler({ err: (e as Error).message, response: null });
    } finally {
      if (cid) {
        this.pending.delete(cid);
        this.logger.debug(`← [Reply] Cleaned up correlation ID: ${cid}`);
      }
    }
  }

  private buildSubject(kind: JsKind, pattern: string): string {
    // order.created -> <service>.<kind>.order.created
    return `${this.opts.serviceName}.${kind}.${pattern}`;
  }
}
