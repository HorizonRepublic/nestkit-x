import { CustomStrategy } from '@nestjs/microservices';
import { JetstreamPullStrategy } from './strategies/jetstream-pull.strategy';
import { IJetstreamTransportOptions } from './types/jetstream-transport.options';

export class JetstreamTransport implements CustomStrategy {
  public strategy!: JetstreamPullStrategy;
  public options: Record<string, string> = {};

  public constructor(options: IJetstreamTransportOptions) {
    this.strategy = new JetstreamPullStrategy(options);
  }
}
