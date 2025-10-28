import { TypedRoute } from '@nestia/core';
import { Controller, Logger } from '@nestjs/common';
import { InjectJetStreamProxy } from '@nestkit-x/jetstream-transport';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, tap } from 'rxjs';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  public constructor(
    // @InjectJetStreamProxy('test-service')
    // private readonly testService: ClientProxy,
  ) {}

  @TypedRoute.Get()
  public async getData(): Promise<any> {
    // await firstValueFrom(
    //   this.testService.emit('test-event', { data: 'HELLO FROM CONTROLLER EVENT!!!' }).pipe(
    //     tap((data) => {
    //       console.log('event data', data);
    //     }),
    //   ),
    // );

    // const data = await firstValueFrom(
    //   this.testService.send('test-cmd', { data: 'HELLO FROM CONTROLLER CMD!!!' }).pipe(
    //     tap((data) => {
    //       console.log('cmd data', data);
    //     }),
    //   ),
    // );
    //
    // return { dataFromRpc: data };
  }
}
