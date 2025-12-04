import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { Observable, of } from 'rxjs';

@Controller()
export class AppMicroController {
  @MessagePattern('test-cmd')
  public msgTest(@Payload() data: unknown): Observable<number> {
    return of(1);
  }

  @EventPattern('test-event')
  public async eventTest(@Payload() data: unknown): Promise<number> {
    return 1;
  }
}
