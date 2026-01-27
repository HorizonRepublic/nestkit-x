import { Controller, NotImplementedException } from '@nestjs/common';
import { IAccountController } from '../types';
import { TypedRoute } from '@nestia/core';

@Controller({ path: 'account' })
export class AccountController implements IAccountController {
  @TypedRoute.Get('me')
  public me(): never {
    throw new NotImplementedException();
  }

  @TypedRoute.Post('change-password')
  public passwordChange(): never {
    throw new NotImplementedException();
  }
}
