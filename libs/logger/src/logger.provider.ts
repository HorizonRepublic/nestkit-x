import { INestApplication, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APP_CONFIG,
  APP_STATE_SERVICE,
  IAppConfig,
  IAppStateService,
  LoadPriority,
} from '@zerly/core';
import { Logger } from 'nestjs-pino';

import { HttpLogInterceptor } from './inetceptors/http-log.interceptor';
import { RpcLogInterceptor } from './inetceptors/rpc-log.interceptor';

@Injectable()
export class LoggerProvider {
  public constructor(
    @Inject(APP_STATE_SERVICE)
    private readonly appStateService: IAppStateService,
    private readonly configService: ConfigService,
  ) {
    this.appStateService.onCreated((app) => {
      this.registerLogger(app);
      this.registerInterceptors(app);
    }, LoadPriority.Logger);
  }

  protected registerInterceptors(app: INestApplication): void {
    const config = this.configService.getOrThrow<IAppConfig>(APP_CONFIG);

    app.useGlobalInterceptors(new HttpLogInterceptor(config), new RpcLogInterceptor());
  }

  protected registerLogger(app: INestApplication): void {
    const logger = app.get(Logger);

    app.useLogger(logger);
    app.flushLogs();
  }
}
