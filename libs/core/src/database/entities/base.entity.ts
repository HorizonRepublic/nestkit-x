import { Entity, Opt, Property, t } from '@mikro-orm/core';
import { v7 } from 'uuid';
import { TimestampType } from '../types/timestamp.type';
import { IBaseResource } from '../../types';

@Entity({ abstract: true })
export abstract class BaseEntity implements IBaseResource {
  @Property({
    name: 'id',
    type: t.uuid,
    onCreate: () => v7(),
    primary: true,
  })
  public id!: Opt<string>;

  @Property({
    name: 'created_at',
    type: TimestampType,
    onCreate: () => Date.now(),
  })
  public createdAt!: Opt<number>;

  @Property({
    name: 'updated_at',
    type: TimestampType,
    onCreate: () => Date.now(),
    onUpdate: () => Date.now(),
  })
  public updatedAt!: Opt<number>;

  @Property({
    name: 'deleted_at',
    type: TimestampType,
    nullable: true,
  })
  public deletedAt: Opt<number> | null = null;
}
