import { Injectable } from '@nestjs/common';
import { MessageProvider } from './message.provider';
import { JsMsg, JSONCodec } from 'nats';
import { PatternRegistry } from '../pattern-registry';
import { from, Observable, of } from 'rxjs';
import { RpcContext } from '../../common/rpc-context';
import { JetstreamHeaders } from '../../enum';

@Injectable()
export class MessageHandlerProvider {
  private readonly codec = JSONCodec(); // todo: allow to configure codec

  public constructor(
    private readonly messageProvider: MessageProvider,
    private readonly patternRegistry: PatternRegistry,
  ) {
    this.messageProvider.commands$.subscribe((msg) => {
      this.handleRpc(msg);
    });

    this.messageProvider.events$.subscribe((msg) => {
      this.handleEvent(msg);
    });
  }

  protected handleRpc(msg: JsMsg): Observable<void> {
    const handler = this.patternRegistry.getHandler(msg.subject);

    if (!handler) {
      msg.term(`No handler found for subject: ${msg.subject}`);

      return of(void 0);
    }

    const data = this.codec.decode(msg.data);
    const ctx = new RpcContext([msg]);
    const response$ = from(handler(data, ctx));
    const reply = msg.headers?.get(JetstreamHeaders.ReplyTo);
    const correlationId = msg.headers?.get(JetstreamHeaders.CorrelationId);

    msg.ack();

    return of(void 0);
  }

  protected handleEvent(msg: JsMsg): Observable<void> {
    msg.ack();

    return of(void 0);
  }
}
