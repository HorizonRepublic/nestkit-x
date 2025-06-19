import { TypedRoute } from '@nestia/core';
import { Controller, Logger } from '@nestjs/common';
import typia from 'typia';

import { AppService } from './app.service';

interface ITestUser {
  firstName: string;
  id: string & typia.tags.Format<'uuid'>;
  lastName: string;
}

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  public constructor(private readonly appService: AppService) {}

  @TypedRoute.Get()
  public getData(): ITestUser {
    this.logger.log('Info log');

    return this.appService.getData();
  }
}
