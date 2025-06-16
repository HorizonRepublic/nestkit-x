import { INestApplication } from '@nestjs/common';
import { Brand } from '@nestkit-x/core/enums';
import { ServiceToken } from '@nestkit-x/core/types';

export const APP_REF_SERVICE_TOKEN = Symbol(`AppRefServiceToken`) as ServiceToken<Brand.App>;

export interface IAppRefService {
  get(): INestApplication;

  set(app: INestApplication): this;
}
