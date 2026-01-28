import { IUserResource } from './user.resource';

export interface IUserRegisterRequest extends Pick<IUserResource, 'email' | 'password'> {}
