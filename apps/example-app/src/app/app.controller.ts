import { Controller, Logger } from '@nestjs/common';
import { TypedRoute } from '@nestia/core';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  @TypedRoute.Get()
  public getData(): number {
    return 5;
  }
}
