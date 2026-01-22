import { ServiceToken } from '@zerly/core';

export const ENV_METADATA_KEY = Symbol('env-metadata') as ServiceToken<'config'>;

export const CONFIG_MODULE_OPTIONS = Symbol('CONFIG_MODULE_OPTIONS') as ServiceToken<'config'>;
