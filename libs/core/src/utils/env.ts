import 'reflect-metadata';

import { ENV_METADATA_KEY } from '../constants';
import { EnumType, EnvTypeConstructor, IEnvFieldMetadata, IEnvOptions } from '../types/env.types';

/**
 * Converts a string environment variable value to the specified type.
 *
 * @param value The string value from process.env.
 * @param type The constructor type or enum to convert to.
 * @returns The converted value as the appropriate type.
 * @throws Error if conversion fails.
 */
const convertValue = (
  value: string,
  type?: EnumType | EnvTypeConstructor,
): boolean | number | string => {
  if (!type || type === String) {
    return value;
  }

  if (type === Number) {
    const num = Number(value);

    if (isNaN(num)) throw new Error(`Cannot convert "${value}" to number`);
    return num;
  }

  if (type === Boolean) {
    return value === 'true' || value === '1';
  }

  return value;
};

/**
 * Property decorator for mapping environment variables to class properties.
 * Stores metadata about the environment variable configuration that will be
 * processed during class initialization.
 *
 * @template TType The type constructor or enum for the environment variable.
 * @param key The environment variable name (e.g., 'PORT', 'NODE_ENV').
 * @param options Configuration options including default value, type, etc.
 * @returns PropertyDecorator function.
 *
 * @example
 * ```TypeScript
 * class Config {
 *   @Env('PORT', { default: 3000, type: Number })
 *   port!: number;
 *
 *   @Env('NODE_ENV', { default: Environment.Development, type: Environment })
 *   env!: Environment;
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Env =
  <TType extends EnumType | EnvTypeConstructor = typeof String>(
    key: string,
    options: IEnvOptions<TType> = {},
  ): PropertyDecorator =>
  (target: object, propertyKey: string | symbol) => {
    const existingMetadata: IEnvFieldMetadata[] =
      Reflect.getMetadata(ENV_METADATA_KEY, target) ?? [];

    existingMetadata.push({
      key,
      options: options as unknown as IEnvOptions<EnumType | EnvTypeConstructor>,
      propertyKey,
    });

    Reflect.defineMetadata(ENV_METADATA_KEY, existingMetadata, target);
  };

/**
 * Initializes a configuration class instance by reading environment variables
 * and applying them to properties decorated with @Env.
 *
 * This function:
 * 1. Creates a new instance of the provided configuration class
 * 2. Reads metadata stored by @Env decorators
 * 3. For each decorated property:
 * - Reads the corresponding environment variable
 * - Applies default values if the env var is not set
 * - Converts the string value to the appropriate type
 * - Sets the property value on the instance
 * 4. Throws errors for missing required environment variables.
 *
 * @template T The configuration class type.
 * @param configClass Constructor function for the configuration class.
 * @returns Fully initialized configuration instance.
 * @throws Error if required environment variables are missing or invalid.
 *
 * @example
 * ```TypeScript
 * class AppConfig {
 *   @Env('PORT', { default: 3000, type: Number })
 *   port!: number;
 *
 *   @Env('DATABASE_URL')
 *   databaseUrl!: string;
 * }
 *
 * const config = initializeEnvConfig(AppConfig);
 * console.log(config.port); // 3000 or value from PORT env var
 * ```
 */
export const initializeEnvConfig = <T extends object>(configClass: new () => T): T => {
  const instance = new configClass();
  const metadata: IEnvFieldMetadata[] = Reflect.getMetadata(ENV_METADATA_KEY, instance) ?? [];

  for (const { key, options, propertyKey } of metadata) {
    const value = process.env[key];

    if (value === undefined && options.default !== undefined) {
      Reflect.set(instance, propertyKey, options.default);
      continue;
    }

    if (value === undefined) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    try {
      const convertedValue = convertValue(value, options.type);

      Reflect.set(instance, propertyKey, convertedValue);
    } catch (error) {
      throw new Error(`Invalid value for ${key}: ${(error as Error).message}`);
    }
  }

  return instance;
};
