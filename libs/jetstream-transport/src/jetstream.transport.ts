import { CustomStrategy } from '@nestjs/microservices';

import { JetstreamPullStrategy } from './strategies/jetstream-pull.strategy';
import { JetstreamPushStrategy } from './strategies/jetstream-push.strategy';
import { IJetstreamTransportOptions } from './types/jetstream-transport.options';

export class JetstreamTransport implements CustomStrategy {
  public options: Record<string, string> = {};

  public strategy!: JetstreamPullStrategy | JetstreamPushStrategy;

  public constructor(options: IJetstreamTransportOptions) {}
}
