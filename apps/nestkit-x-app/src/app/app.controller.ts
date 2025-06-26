import { TypedRoute } from '@nestia/core';
import { Controller, Logger } from '@nestjs/common';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  @TypedRoute.Get()
  public getData(): void {
    return void 0;
  }
}
