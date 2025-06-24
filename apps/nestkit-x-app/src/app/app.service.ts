import { Injectable } from '@nestjs/common';
import { v7 } from 'uuid';

@Injectable()
export class AppService {
  public getData() {
    return {
      firstName: 'Some firstName',
      id: v7(),
      lastName: 'some lastname',
    } as const;
  }
}
