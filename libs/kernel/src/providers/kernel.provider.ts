import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { APP_CONFIG, APP_STATE_SERVICE } from '../const/index';
import { IAppConfig, IAppStateService } from '../types';

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
      this.logger.log(`Application is listening on http://${config.host}:${config.port}`);
    });
  }
}
