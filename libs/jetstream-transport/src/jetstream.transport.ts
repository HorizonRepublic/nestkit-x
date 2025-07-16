import { CustomStrategy } from '@nestjs/microservices';

import { JetstreamPullStrategy } from './strategies/jetstream-pull.strategy';
import { JetstreamPushStrategy } from './strategies/jetstream-push.strategy';
import { IJetstreamTransportOptions } from './types/jetstream-transport.options';
import { JetstreamTransportStrategy } from './conts';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

export class JetstreamTransport implements CustomStrategy {
  public strategy!: JetstreamPullStrategy | JetstreamPushStrategy;
  public options: Record<string, string> = {};

  public constructor(options: IJetstreamTransportOptions) {
    this.strategy = this.createStrategy(options);
  }

  private createStrategy(
    options: IJetstreamTransportOptions,
  ): JetstreamPullStrategy | JetstreamPushStrategy {
    const strategies = {
      [JetstreamTransportStrategy.Push]: () => new JetstreamPushStrategy(options),
      [JetstreamTransportStrategy.Pull]: () => new JetstreamPullStrategy(options),
    };

    const strategyFactory = strategies[options.jetStreamStrategy];

    if (!strategyFactory) throw new RuntimeException(`Unknown strategy: ${options.jetStreamStrategy}`);

    return strategyFactory();
  }
}
