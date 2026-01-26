import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_CONFIG, APP_STATE_SERVICE, IAppConfig, IAppStateService } from '@zerly/core';
import { getRuntime, getRuntimeVersion } from '../helpers/get-runtime.helper';

@Injectable()
export class KernelProvider {
  private readonly logger = new Logger(KernelProvider.name);

  public constructor(
    @Inject(APP_STATE_SERVICE)
    private readonly appStateService: IAppStateService,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.getOrThrow<IAppConfig>(APP_CONFIG);

    this.appStateService.onListening(() => {
      const runtime = getRuntime();

      this.logger.debug(
        `Runtime: ${runtime.charAt(0).toUpperCase() + runtime.slice(1)} ${getRuntimeVersion()}`,
      );

      this.logger.log(`Application is listening on http://${config.host}:${config.port}`);
    });
  }
}
