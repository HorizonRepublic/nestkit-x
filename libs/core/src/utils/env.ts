import * as process from 'node:process';

import { RuntimeException } from '@nestjs/core/errors/exceptions';

export const env = <T = never>(key: keyof (typeof process)['env'], defaultValue?: T): never | T => {
  const value = process.env[key] ?? defaultValue;

  if (!value) throw new RuntimeException(`Missing environment variable: ${key}`);

  return value as T;
};
