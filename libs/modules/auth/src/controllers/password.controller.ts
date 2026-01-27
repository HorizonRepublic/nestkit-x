import { Controller } from '@nestjs/common';
import { IPasswordController } from '../types';
import { TypedRoute } from '@nestia/core';

@Controller('auth/password')
export class PasswordController implements IPasswordController {
  @TypedRoute.Post('forgot')
  public forgot(): never {
    throw new Error('Method not implemented.');
  }

  @TypedRoute.Post('reset/:token')
  public reset(): never {
    throw new Error('Method not implemented.');
  }
}
