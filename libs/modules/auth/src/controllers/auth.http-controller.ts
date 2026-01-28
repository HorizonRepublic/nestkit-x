import { Controller, NotImplementedException } from '@nestjs/common';
import { IAuthController } from '../types';
import { TypedRoute } from '@nestia/core';
import { IUserRegisterRequest } from '../resources/user-register.request';

@Controller()
export class AuthHttpController implements IAuthController {
  /**
   * Auth related routes
   */

  @TypedRoute.Post('auth/register')
  public register(data: IUserRegisterRequest): never {
    throw new NotImplementedException();
  }

  @TypedRoute.Post('auth/login')
  public login(): never {
    throw new NotImplementedException();
  }

  @TypedRoute.Post('auth/logout')
  public logout(): never {
    throw new NotImplementedException();
  }

  @TypedRoute.Post('auth/refresh')
  public refresh(): never {
    throw new NotImplementedException();
  }

  @TypedRoute.Post('auth/verify')
  public verify(): never {
    throw new NotImplementedException();
  }

  /**
   * Account-related routes
   */

  @TypedRoute.Get('account/me')
  public me(): never {
    throw new NotImplementedException();
  }

  @TypedRoute.Post('account/change-password')
  public passwordChange(): never {
    throw new NotImplementedException();
  }

  /**
   * Recovery-related routes
   */

  @TypedRoute.Post('password/forgot')
  public forgot(): never {
    throw new Error('Method not implemented.');
  }

  @TypedRoute.Post('password/reset/:token')
  public reset(): never {
    throw new Error('Method not implemented.');
  }
}
