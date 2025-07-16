import { Server, TransportId } from '@nestjs/microservices';
import { CustomTransportStrategy } from '@nestjs/microservices/interfaces/custom-transport-strategy.interface';
import { Codec, connect as natsConnect, JetStreamManager, JSONCodec, NatsConnection } from 'nats';
import { defer, from, map, Observable, shareReplay, switchMap } from 'rxjs';
import { Logger } from '@nestjs/common';

import { IJetstreamTransportOptions } from '../types/jetstream-transport.options';
import { AnyCallback, AnyCallbackResult } from '../types/callback.types';

export abstract class JetstreamStrategy extends Server implements CustomTransportStrategy {
  public override readonly transportId: TransportId = Symbol('NATS_JETSTREAM_TRANSPORT');

  protected readonly codec: Codec<JSON> = JSONCodec();

  private jetStreamManager$: Observable<JetStreamManager> | null = null;
  private natsConnection$: Observable<NatsConnection> | null = null;

  public constructor(protected readonly options: IJetstreamTransportOptions) {
    super();
    this.setLogger();
  }

  private setLogger(): void {
    if (!this.options.logger) {
      this.options.logger = new Logger(`JetStreamServer-${this.options.serviceName}`);
    }
  }

  /**
   * Get NATS plain connection
   * @protected
   */
  protected getNatsConnection(): Observable<NatsConnection> {
    if (this.natsConnection$) return this.natsConnection$;

    const natsConnector = defer(() => from(natsConnect(this.options.connectionOptions)));
    this.natsConnection$ = natsConnector.pipe(shareReplay({ bufferSize: 1, refCount: true }));

    return this.natsConnection$;
  }

  /**
   * Extract JetStream connection from NATS connection
   * @protected
   */
  protected getJetStreamManager(): Observable<JetStreamManager> {
    if (this.jetStreamManager$) {
      return this.jetStreamManager$;
    }

    this.jetStreamManager$ = this.getNatsConnection().pipe(
      switchMap((connection) =>
        defer(() => from(connection.jetstreamManager(this.options.jetstreamOptions))),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    return this.jetStreamManager$;
  }

  /**
   * Helper method to get both connection and jetstream manager
   * @protected
   */
  protected getConnections(): Observable<{
    connection: NatsConnection;
    jetStreamManager: JetStreamManager;
  }> {
    return this.getNatsConnection().pipe(
      switchMap((connection) =>
        this.getJetStreamManager().pipe(
          map((jetStreamManager) => ({ connection, jetStreamManager })),
        ),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  public abstract override listen(callback: AnyCallback): AnyCallbackResult;

  public abstract override close(): void;
}
