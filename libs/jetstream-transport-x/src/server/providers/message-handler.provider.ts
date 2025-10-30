import { Injectable, Logger } from '@nestjs/common';
import { MessageProvider } from './message.provider';
import { headers, JsMsg, JSONCodec } from 'nats';
import { PatternRegistry } from '../pattern-registry';
import { catchError, EMPTY, from, mergeMap, Observable, of, switchMap } from 'rxjs';
import { RpcContext } from '../../common/rpc-context';
import { JetstreamHeaders } from '../../enum';
import { ConnectionProvider } from '../../common/connection.provider';

@Injectable()
export class MessageHandlerProvider {
  private readonly codec = JSONCodec(); // todo: allow to configure codec

  private readonly logger = new Logger(MessageHandlerProvider.name);

  public constructor(
    private readonly messageProvider: MessageProvider,
    private readonly patternRegistry: PatternRegistry,
    private readonly connectionProvider: ConnectionProvider,
  ) {
    this.messageProvider.commands$
      .pipe(
        mergeMap((msg) => this.handleRpc(msg)),
        catchError((error, caught) => {
          this.logger.error('Error in RPC handler:', error);

          return caught;
        }),
      )
      .subscribe();

    this.messageProvider.events$
      .pipe(
        mergeMap((msg) => this.handleEvent(msg)),
        catchError((error, caught) => {
          this.logger.error('Error in event handler:', error);

          return caught;
        }),
      )
      .subscribe();
  }

  protected handleRpc(msg: JsMsg): Observable<void> {
    const handler = this.patternRegistry.getHandler(msg.subject);

    if (!handler) {
      msg.term(`No handler found for subject: ${msg.subject}`);

      return of(void 0);
    }

    const correlationId = msg.headers?.get(JetstreamHeaders.CorrelationId);
    const replyTo = msg.headers?.get(JetstreamHeaders.ReplyTo);

    if (!replyTo) {
      msg.term(`Reply-to header is missing in RPC message: ${msg.subject}`);
      this.logger.error(`Reply-to header is missing in RPC message: ${msg.subject}`);

      return of(void 0);
    }

    if (!correlationId) {
      msg.term(`Correlation-id header is missing in RPC message: ${msg.subject}`);
      this.logger.error(`Correlation-id header is missing in RPC message: ${msg.subject}`);

      return of(void 0);
    }

    const ctx = new RpcContext([msg]);
    const data = this.codec.decode(msg.data);
    const hdrs = headers();
    const handlerResult = handler(data, ctx);

    if (correlationId) hdrs.set(JetstreamHeaders.CorrelationId, correlationId);

    return this.connectionProvider.nc.pipe(
      switchMap((nc) =>
        from(handlerResult).pipe(
          switchMap((inner) => from(inner)),
          switchMap((actualResponse) => {
            const encodedResponse = this.codec.encode(actualResponse);

            nc.publish(replyTo, encodedResponse, { headers: hdrs });
            msg.ack();

            return of(void 0);
          }),

          catchError((error) => {
            this.logger.error(`Error handling RPC for ${msg.subject}:`, error);
            msg.term(`Handler error: ${error.message}`);

            return EMPTY;
          }),
        ),
      ),
    );
  }

  protected handleEvent(msg: JsMsg): Observable<void> {
    msg.ack();

    return of(void 0);
  }
}
