import { Brand } from '../enums';
import { ServiceToken } from '../types';

export const APP_REF_SERVICE = Symbol(`app-reference-service`) as ServiceToken<Brand.App>;

export const APP_STATE_SERVICE = Symbol(`app-state-service`) as ServiceToken<Brand.App>;

export const APP_CONFIG = Symbol('app-config') as ServiceToken<Brand.Config>;
