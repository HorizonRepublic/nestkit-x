/**
 * Allows adding a brand to a type.
 *
 * @example
 *
 * Branded<symbol, { kind: 'brand-name'; name: Name }>;
 */
//eslint-disable-next-line @typescript-eslint/naming-convention
export type Branded<K, T> = K & { readonly __brand__: T };

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
export type ServiceToken<Name extends string> = Branded<symbol, { kind: 'service'; name: Name }>;
