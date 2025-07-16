import { JetstreamTransportStrategy } from '../conts';

export interface IJetstreamPullOptions {
  stream: {};
}

export interface IJetstreamPushOptions {
  stream: {};
}

export interface IJetstreamTransportOptions<
  T extends JetstreamTransportStrategy = JetstreamTransportStrategy,
> {
  options: T extends JetstreamTransportStrategy.Pull
    ? IJetstreamPullOptions
    : T extends JetstreamTransportStrategy.Push
      ? IJetstreamPushOptions
      : never;

  servers: string[];
  serviceName: string;
  strategy: T;
}
