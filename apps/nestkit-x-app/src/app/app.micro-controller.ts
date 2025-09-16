import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import * as console from 'node:console';
import { Observable, of } from 'rxjs';

@Controller()
export class AppMicroController {
  @MessagePattern('test-cmd')
  public msgTest(@Payload() data: unknown): Observable<number> {
    console.log('RPC received', data);

    return of(1);
  }

  @EventPattern('test-event')
  public eventTest(@Payload() data: unknown): number {
    console.log('EVENT received', data);

    return 1;
  }
}
