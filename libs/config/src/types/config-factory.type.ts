import type {
  ConfigFactory as BaseConfigFactory,
  ConfigFactoryKeyHost as BaseConfigFactoryKeyHost,
  ConfigObject,
} from '@nestjs/config';

export type ConfigFactory<T extends ConfigObject = ConfigObject> = BaseConfigFactory<T>;

export type ConfigFactoryKeyHost<T = unknown> = BaseConfigFactoryKeyHost<T>;
