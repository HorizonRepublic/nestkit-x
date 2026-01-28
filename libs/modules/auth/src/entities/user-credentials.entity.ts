import { BaseEntity } from '@zerly/core';
import { Entity, Enum, ManyToOne, Opt, Property, t } from '@mikro-orm/core';
import { UserEntity } from './user.entity';
import { AuthProvider } from '../enum/index';

@Entity({ tableName: 'user_credentials' })
export class UserCredentialEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, { deleteRule: 'cascade' })
  public user!: UserEntity;

  @Enum(() => AuthProvider)
  public provider!: AuthProvider;

  @Property({ nullable: true, type: t.string })
  public externalId: Opt<string> | null = null;

  @Property({ nullable: true, hidden: true, type: t.string })
  public password: Opt<string> | null = null;
}
