import { INestApplication, Injectable, Logger } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

import { IAppRefService } from '../types/app-ref-service.interface';

@Injectable()
export class AppRefService implements IAppRefService {
  protected appRef: INestApplication | null = null;
  protected readonly logger = new Logger(AppRefService.name);

  public get(): INestApplication {
    if (!this.appRef) {
      throw new RuntimeException(`AppRefService.getApp() has not been called yet.`);
    }

    return this.appRef;
  }

  public set(app: INestApplication): this {
    if (this.appRef) {
      this.logger.warn(`AppRefService.setApp() has already been called.`);

      return this;
    }

    this.appRef = app;

    return this;
  }
}
