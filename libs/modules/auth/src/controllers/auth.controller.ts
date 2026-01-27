import { Controller, NotImplementedException } from '@nestjs/common';
import { IAuthController } from '../types';
import { TypedRoute } from '@nestia/core';

@Controller({ path: 'auth' })
export class AuthController implements IAuthController {
  @TypedRoute.Post('register')
  public register(): never {
    throw new NotImplementedException();
  }

  @TypedRoute.Post('login')
  public login(): never {
    throw new NotImplementedException();
  }

  @TypedRoute.Post('logout')
  public logout(): never {
    throw new NotImplementedException();
  }

  @TypedRoute.Post('refresh')
  public refresh(): never {
    throw new NotImplementedException();
  }

  @TypedRoute.Post('verify')
  public verify(): never {
    throw new NotImplementedException();
  }
}
