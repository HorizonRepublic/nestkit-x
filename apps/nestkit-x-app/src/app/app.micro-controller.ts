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
  public async eventTest(@Payload() data: unknown): Promise<number> {
    console.log('EVENT received', data);

    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

    await sleep(3000);

    console.log('Timeout end', data);

    return 1;
  }
}
