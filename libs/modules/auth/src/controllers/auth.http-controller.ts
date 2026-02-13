import { Controller, NotImplementedException } from '@nestjs/common';
import { EventPattern, MessagePattern } from '@nestjs/microservices';

import { TypedRoute } from '@nestia/core';

import { IUserRegisterRequest } from '../resources/user-register.request';
import { IAuthController } from '../types';

@Controller({ path: 'auth' })
export class AuthHttpController implements IAuthController {
  /**
   * Auth related routes
   */

  @TypedRoute.Post('register')
  public register(_: IUserRegisterRequest): never {
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

  @MessagePattern('test-pattern')
  public test(): never {
    throw new Error('Method not implemented.');
  }

  @EventPattern('test-event')
  public test3(): never {
    throw new Error('Method not implemented.');
  }
}
