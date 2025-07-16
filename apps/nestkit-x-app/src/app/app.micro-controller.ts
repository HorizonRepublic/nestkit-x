import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import * as console from 'node:console';
import { of } from 'rxjs';

@Controller()
export class AppMicroController {
  @MessagePattern('test-cmd')
  public msgTest(@Payload() data: unknown) {
    console.log('DATA!!!', data);
    return of(1);
  }

  @EventPattern('test-event')
  public eventTest(@Payload() data: unknown) {
    console.log('DATA!!', data);
    return 1;
  }
}
