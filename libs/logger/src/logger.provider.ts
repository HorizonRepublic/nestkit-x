import { INestApplication, Inject, Injectable } from '@nestjs/common';

import { Logger } from 'nestjs-pino';

import { LoadPriority } from '@zerly/config';
import { APP_STATE_SERVICE, IAppStateService } from '@zerly/kernel';

@Injectable()
export class LoggerProvider {
  public constructor(
    @Inject(APP_STATE_SERVICE)
    private readonly appStateService: IAppStateService,
  ) {
    this.appStateService.onCreated((app) => {
      this.registerLogger(app);
    }, LoadPriority.Logger);
  }

  protected registerLogger(app: INestApplication): void {
    const logger = app.get(Logger);

    app.useLogger(logger);
    app.flushLogs();
  }
}
