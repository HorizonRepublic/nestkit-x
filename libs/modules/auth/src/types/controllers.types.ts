import { IUserRegisterRequest } from '../resources';

export interface IAuthController {
  register(data: IUserRegisterRequest): never;
}
