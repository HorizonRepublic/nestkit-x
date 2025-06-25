import { TypedRoute } from '@nestia/core';
import { Controller, Inject, Logger } from '@nestjs/common';
import { APP_STATE_SERVICE, IAppStateService } from '@nestkit-x/core';
import typia from 'typia';

interface ITestUser {
  firstName: string;
  id: string & typia.tags.Format<'uuid'>;
  lastName: string;
}

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  public constructor(
    @Inject(APP_STATE_SERVICE)
    private readonly appStateService: IAppStateService,
  ) {
    // extract as example
    this.appStateService.onCreated((app) => {
      this.logger.log('App created #3');
    }, 3);

    this.appStateService.onCreated((app) => {
      this.logger.log('App created #2');
    }, 2);

    this.appStateService.onCreated((app) => {
      this.logger.log('App created #1');
    }, 1);
  }

  @TypedRoute.Get()
  public getData(): void {
    return void 0;
  }
}
