import { CustomStrategy } from '@nestjs/microservices';

import { JetstreamPushStrategy } from './strategies/jetstream-push.strategy';
import { JetstreamPullStrategy } from './strategies/jetstream-pull.strategy';
import { IJetstreamTransportOptions } from './types/jetstream-transport.options';
import { JetstreamTransportStrategy } from './conts';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

export class JetstreamTransport implements CustomStrategy {
  public strategy!: JetstreamPushStrategy | JetstreamPullStrategy;
  public options: Record<string, string> = {};

  public constructor(options: IJetstreamTransportOptions) {
    this.strategy = this.createStrategy(options);
  }

  private createStrategy(
    options: IJetstreamTransportOptions,
  ): JetstreamPushStrategy | JetstreamPullStrategy {
    const strategies = {
      [JetstreamTransportStrategy.Push]: () => new JetstreamPullStrategy(options),
      [JetstreamTransportStrategy.Pull]: () => new JetstreamPushStrategy(options),
    };

    const strategyFactory = strategies[options.jetStreamStrategy];

    if (!strategyFactory) throw new RuntimeException(`Unknown strategy: ${options.jetStreamStrategy}`);

    return strategyFactory();
  }
}
