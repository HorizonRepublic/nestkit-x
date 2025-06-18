import { Env, Environment, initializeEnvConfig } from '@nestkit-x/core';
import { IAppConfig } from '@nestkit-x/kernel';

class AppConfig implements IAppConfig {
  @Env('APP_ENV', { default: Environment.Dev, type: Environment })
  public env!: Environment;

  @Env('APP_HOST', { default: '0.0.0.0' })
  public host!: string;

  @Env('APP_NAME', { example: 'NestKit X App' })
  public name!: string;

  @Env('APP_PORT', { default: 3000, type: Number })
  public port!: number;

  @Env('APP_VERSION', { default: '0.0.1' })
  public version!: string;
}

export const appConfig = initializeEnvConfig(AppConfig);
