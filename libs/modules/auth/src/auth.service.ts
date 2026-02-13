import { Injectable, NotImplementedException } from '@nestjs/common';

import { IAuthService } from './types';

@Injectable()
export class AuthService implements IAuthService {
  public register(): never {
    throw new NotImplementedException();
  }
}
