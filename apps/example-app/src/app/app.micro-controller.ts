import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern } from '@nestjs/microservices';
import { Observable, of } from 'rxjs';

@Controller()
export class AppMicroController {
  @MessagePattern('test-cmd')
  public msgTest(): Observable<number> {
    return of(1);
  }

  @EventPattern('test-event')
  public async eventTest(): Promise<number> {
    return 1;
  }
}
