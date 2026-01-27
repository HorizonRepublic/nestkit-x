import { IAuthController } from './controllers.types';
import { IAuthService } from './auth-service.interface';
import { Type } from '@nestjs/common/interfaces/type.interface';

export interface IAuthModuleOptions {
  controller?: Type<IAuthController>;
  service?: Type<IAuthService>;
}
