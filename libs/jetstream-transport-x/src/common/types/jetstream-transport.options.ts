import { ConnectionOptions } from 'nats/lib/src/nats-base-client';
import { ServiceType } from '../enum/service-type.enum';

export interface IJetstreamTransportOptions extends ConnectionOptions {
  name: string;
  servers: string[];
  serviceType: ServiceType;
}
