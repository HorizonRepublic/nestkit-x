import { TypedRoute } from '@nestia/core';
import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, tap } from 'rxjs';
import { MessageStats } from './msg-stats';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  private readonly stats = MessageStats.getInstance();

  public constructor(
    @Inject('test-service')
    private readonly testService: ClientProxy,
  ) {}

  @TypedRoute.Get('stats')
  public getStats(): any {
    return this.stats.getStats();
  }

  @TypedRoute.Get()
  public async getData(): Promise<any> {
    await firstValueFrom(
      this.testService.emit('test-event', { data: 'HELLO FROM CONTROLLER EVENT!!!' }).pipe(
        tap((data) => {
          this.stats.incrementEventsSent();
        }),
      ),
    );

    // const data = await firstValueFrom(
    //   this.testService.send('test-cmd', { data: 'HELLO FROM CONTROLLER CMD!!!' }).pipe(
    //     tap((data) => {
    //       console.log('cmd data', data);
    //     }),
    //   ),
    // );

    return {};
    // return { dataFromRpc: data };
  }
}
