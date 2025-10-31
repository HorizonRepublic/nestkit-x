import { ConnectionOptions } from 'nats/lib/src/nats-base-client';

export interface IJetstreamTransportOptions extends ConnectionOptions {
  name: string;
  servers: string[];
}
