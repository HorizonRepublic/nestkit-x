import { Entity, Opt, Property, t } from '@mikro-orm/core';
import { IUserResource } from '../resources/user.resource';
import { UserRepository } from './user.repository';
import { BaseEntity } from '@zerly/db';

@Entity({ tableName: 'users', repository: () => UserRepository })
export class UserEntity extends BaseEntity implements IUserResource {
  @Property({ unique: true, type: t.string })
  public email!: string;

  @Property({ type: t.boolean })
  public verified: Opt<boolean> = false;
}
