import { IAccountController, IAuthController, IPasswordController } from './controllers.types';
import { IAuthService } from './auth-service.interface';
import { Type } from '@nestjs/common/interfaces/type.interface';

export interface IAuthModuleOptions {
  controllers?: {
    auth?: Type<IAuthController>;
    account?: Type<IAccountController>;
    password?: Type<IPasswordController>;
  };

  service?: Type<IAuthService>; // todo: split too?
}
