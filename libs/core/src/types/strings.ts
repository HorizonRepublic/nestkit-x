import { Brand } from '@nestkit-x/core/enums';
import { tags } from 'typia';

import { Branded } from './global';

export type SemVer = Lowercase<string> & tags.Pattern<'^[0-9]+\\.[0-9]+\\.[0-9]+$'>;

/**
 * Why: to prevent using the wrong service tokens in custom decorators.
 *
 * @example
 * const token = Symbol('logger') as ServiceToken<Brand.Logger>;
 *
 * const Decorator1 = (token: ServiceToken<Brand.Logger>) => {};
 *
 * const Decorator2 = (token: ServiceToken<'wrong-branded'>) => {};
 *
 * Decorator1(token); // pass
 * Decorator2(token); // fail
 */
export type ServiceToken<Name extends string> = Branded<symbol, { kind: Brand.Logger; name: Name }>;
