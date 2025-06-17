import { ConfigFactoryKeyHost, registerAs } from '@nestjs/config';
import typia from 'typia';

import { APP_CONFIG } from '../const/index';
import { IAppConfig } from '../types';

export const createAppConfig = (
  config: IAppConfig,
): (() => IAppConfig) & ConfigFactoryKeyHost<IAppConfig> =>
  registerAs(APP_CONFIG, () => typia.assertEquals<IAppConfig>(config));
