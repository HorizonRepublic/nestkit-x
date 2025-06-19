import { Controller, Get, UnauthorizedException } from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  public constructor(private readonly appService: AppService) {}

  @Get()
  public getData(): { message: string } {
    throw new UnauthorizedException(`Test exception`);

    return this.appService.getData();
  }
}
