import { TypedRoute } from '@nestia/core';
import { Controller, Logger } from '@nestjs/common';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  public constructor() {}

  @TypedRoute.Get('stats')
  public getStats(): Record<string, unknown> {
    return {};
  }

  @TypedRoute.Get()
  public async getData(): Promise<undefined> {}
}
