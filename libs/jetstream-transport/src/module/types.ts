import { IJetstreamTransportOptions } from '../types/jetstream-transport.options';
import { Type } from '@nestjs/common';

export type IJetStreamClientOptions = Pick<
  IJetstreamTransportOptions,
  'serviceName' | 'connectionOptions' | 'jetstreamOptions'
>;

export type InjectableType =
  | string
  | symbol
  | Type<unknown>
  | (abstract new (...a: unknown[]) => unknown);

export interface IJetStreamAsyncConfig {
  name: string;
  global?: boolean;
  inject?: readonly InjectableType[];

  useFactory(...args: unknown[]): Promise<IJetStreamClientOptions> | IJetStreamClientOptions;
}
