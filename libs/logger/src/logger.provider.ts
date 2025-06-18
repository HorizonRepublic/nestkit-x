import { INestApplication, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APP_CONFIG,
  APP_REF_SERVICE,
  APP_STATE_SERVICE,
  IAppConfig,
  IAppRefService,
  IAppStateService,
} from '@nestkit-x/kernel';
import { Logger } from 'nestjs-pino';

import { HttpLogInterceptor } from './inetceptors/http-log.interceptor';
import { RpcLogInterceptor } from './inetceptors/rpc-log.interceptor';

@Injectable()
export class LoggerProvider {
  public constructor(
    @Inject(APP_REF_SERVICE)
    private readonly appRef: IAppRefService,
    @Inject(APP_STATE_SERVICE)
    private readonly appStateService: IAppStateService,
    private readonly configService: ConfigService,
  ) {
    this.appStateService.onCreated(() => {
      const app = this.appRef.get();

      this.registerLogger(app);
      this.registerInterceptors(app);
    });
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
