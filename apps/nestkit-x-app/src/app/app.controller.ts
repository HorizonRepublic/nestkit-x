import { TypedRoute } from '@nestia/core';
import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  public constructor(
    @Inject('test-service')
    private readonly testService: ClientProxy,
  ) {}

  @TypedRoute.Get('stats')
  public getStats(): Record<string, unknown> {
    return {};
  }

  @TypedRoute.Get()
  public async getData(): Promise<undefined> {
    await firstValueFrom(
      this.testService
        .emit('test-event', {
          data: 'HELLO FROM CONTROLLER EVENT!!!',
        })
        .pipe(),
    );

    return firstValueFrom(
      this.testService.send('test-cmd', { data: 'HELLO FROM CONTROLLER CMD!!!' }).pipe(),
    );
  }
}
