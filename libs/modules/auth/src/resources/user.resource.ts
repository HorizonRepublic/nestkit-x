import { IBaseResource } from '@zerly/core';
import typia from 'typia';

export interface IUserResource extends IBaseResource {
  email: string & typia.tags.Format<'email'>;
}
