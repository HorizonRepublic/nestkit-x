import { BadRequestException, Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  public constructor(private readonly appService: AppService) {}

  @Get()
  public getData(): { message: string } {
    throw new Error(`Test exception`);

    return this.appService.getData();
  }
}
