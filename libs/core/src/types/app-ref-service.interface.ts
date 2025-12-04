import { INestApplication } from '@nestjs/common';

export interface IAppRefService {
  get(): INestApplication;

  set(app: INestApplication): this;
}
