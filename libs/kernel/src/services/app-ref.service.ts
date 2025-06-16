import { INestApplication, Injectable } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

import { IAppRefService } from '../types/app-ref-service.interface';

@Injectable()
export class AppRefService implements IAppRefService {
  protected appRef: INestApplication | null = null;

  public get(): INestApplication {
    if (!this.appRef) {
      throw new RuntimeException(`AppRefService.getApp() has not been called yet.`);
    }

    return this.appRef;
  }

  public set(app: INestApplication): this {
    if (this.appRef) {
      throw new RuntimeException(`AppRefService.setApp() has already been called.`);
    }

    this.appRef = app;

    return this;
  }
}
