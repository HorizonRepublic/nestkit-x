import { CustomStrategy } from '@nestjs/microservices';
import { IJetstreamTransportOptions } from './types/jetstream-transport.options';
import { JetstreamStrategy } from './jetstream.strategy';

export class JetstreamTransport implements CustomStrategy {
  public strategy!: JetstreamStrategy;
  public options: Record<string, string> = {};

  public constructor(options: IJetstreamTransportOptions) {
    this.strategy = new JetstreamStrategy(options);
  }
}
