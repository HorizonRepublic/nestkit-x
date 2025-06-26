import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APP_CONFIG,
  APP_STATE_SERVICE,
  Environment,
  IAppConfig,
  IAppStateService,
} from '@nestkit-x/core';

@Injectable()
export class KernelProvider {
  private readonly basicConfig: IAppConfig = {
    env: Environment.Local,
    host: '0.0.0.0',
    name: 'NestKit-X App',
    port: 3000,
    version: '0.0.0',
  } as const;

  private readonly logger = new Logger(KernelProvider.name);

  public constructor(
    @Inject(APP_STATE_SERVICE)
    private readonly appStateService: IAppStateService,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.getOrThrow<IAppConfig>(APP_CONFIG);

    // this.appStateService.onCreated((app) => {
    //   app.use(helmet()); // make optional feature (!)
    //   app.enableCors();
    // });

    this.appStateService.onListening(() => {
      this.logger.debug(`Node version: ${process.version}`);
      this.logger.log(`Application is listening on http://${config.host}:${config.port}`);
    });
  }
}
