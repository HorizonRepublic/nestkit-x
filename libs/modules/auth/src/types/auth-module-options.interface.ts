import { IAuthController } from './auth-controller.interface';
import { IAuthService } from './auth-service.interface';

export interface IAuthModuleOptions {
  controller: IAuthController;
  service: IAuthService;
}
