import { ConnectionOptions, JetStreamOptions } from 'nats/lib/src/nats-base-client';

import { JetstreamTransportStrategy } from '../conts';
import { ConsumerConfig } from 'nats';

export interface IJetstreamPullOptions {}

export interface IJetstreamPushOptions {}

export interface IJetstreamTransportOptions<
  JetStreamStrategy extends JetstreamTransportStrategy = JetstreamTransportStrategy,
> {
  jetStreamStrategy: JetStreamStrategy;

  streamOptions: JetStreamStrategy extends JetstreamTransportStrategy.Pull
    ? IJetstreamPullOptions
    : JetStreamStrategy extends JetstreamTransportStrategy.Push
      ? IJetstreamPushOptions
      : never;

  jetstreamOptions: JetStreamOptions;

  serviceName: string;
  connectionOptions: ConnectionOptions; // todo: pick needed
}


export interface JetstreamConsumerSetup {
  stream: string;
  config: ConsumerConfig;
}