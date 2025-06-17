import { Environment, env } from '@nestkit-x/core';
import { IAppConfig } from '@nestkit-x/kernel';

export const appConfig: IAppConfig = {
  env: env('APP_ENV', Environment.Dev),
  host: env('APP_HOST', '0.0.0.0'),
  name: env('APP_NAME'),
  port: +env('APP_PORT', 3000),
  version: env('APP_VERSION', '0.0.1'),
};
