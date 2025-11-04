import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import * as console from 'node:console';
import { Observable, of } from 'rxjs';
import { MessageStats } from './msg-stats';

@Controller()
export class AppMicroController {
  private readonly stats = MessageStats.getInstance();

  @MessagePattern('test-cmd')
  public msgTest(@Payload() data: unknown): Observable<number> {
    console.log('RPC received in controller with data', data);

    return of(1);
  }

  @EventPattern('test-event')
  public async eventTest(@Payload() data: unknown): Promise<number> {
    // console.log(`Event received in controller with data`, data);

    this.stats.incrementEventsReceived();

    return 1;
  }
}
