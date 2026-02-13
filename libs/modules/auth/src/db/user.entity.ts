import { Entity, Opt, Property, t } from '@mikro-orm/core';

import { BaseEntity } from '@zerly/db';

import { IUserResource } from '../resources/user.resource';

import { UserRepository } from './user.repository';

@Entity({ tableName: 'users', repository: () => UserRepository })
export class UserEntity extends BaseEntity implements IUserResource {
  @Property({ unique: true, type: t.string })
  public email!: string;

  @Property({ type: t.boolean })
  public verified: Opt<boolean> = false;
}
