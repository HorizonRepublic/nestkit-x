import { Type } from '@nestjs/common/interfaces/type.interface';

import { IAuthService } from './auth-service.interface';
import { IAuthController } from './controllers.types';

export interface IAuthModuleOptions {
  controller?: Type<IAuthController>;
  service?: Type<IAuthService>;
}
