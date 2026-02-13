import typia from 'typia';

import { IBaseResource } from '@zerly/core';

export interface IUserResource extends IBaseResource {
  email: string & typia.tags.Format<'email'>;
}
