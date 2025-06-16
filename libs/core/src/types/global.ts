/**
 * Allows adding a brand to a type.
 *
 * @example
 *
 * Branded<symbol, { kind: 'brand-name'; name: Name }>;
 */
//eslint-disable-next-line @typescript-eslint/naming-convention
export type Branded<K, T> = K & { readonly __brand__: T };
