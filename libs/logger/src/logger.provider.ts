import { Inject, Injectable } from '@nestjs/common';
import {
  APP_REF_SERVICE,
  APP_STATE_SERVICE,
  IAppRefService,
  IAppStateService,
} from '@nestkit-x/kernel';
import { Logger } from 'nestjs-pino';

@Injectable()
export class LoggerProvider {
  public constructor(
    @Inject(APP_REF_SERVICE)
    private readonly appRef: IAppRefService,

    @Inject(APP_STATE_SERVICE)
    private readonly appStateService: IAppStateService,
  ) {
    this.appStateService.onCreated(() => {
      this.register();
    });
  }

  protected register(): void {
    const app = this.appRef.get();
    const logger = app.get(Logger);

    app.useLogger(logger);
    app.flushLogs();
  }
}
