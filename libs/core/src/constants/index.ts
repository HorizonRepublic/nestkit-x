import { network } from './network';
import * as patterns from './patterns';

export const ENV_METADATA_KEY = Symbol('env-metadata');

export const constants = { network, patterns };
