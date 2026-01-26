import { APP_CONFIG, Environment, IAppConfig } from '@zerly/core';
import { ConfigBuilder, Env } from '@zerly/config';
import typia from 'typia';
import { LevelWithSilent } from 'pino';

class AppConfig implements IAppConfig {
  @Env('APP_ENV', {
    type: Environment,
    comment: 'App environment',
  })
  public readonly env: Environment = Environment.Prod;

  @Env('APP_HOST')
  public readonly host: string = '0.0.0.0';

  @Env('APP_NAME', {
    comment: 'kebab-case is recommended',
  })
  public readonly name: string = 'example-app';

  @Env('APP_PORT', {
    type: Number,
  })
  public readonly port: number = 3000;

  @Env('APP_GENERATE_ENV_EXAMPLE', {
    type: Boolean,
    comment: 'Use false in production',
  })
  public generateEnvExample = true;

  @Env('APP_LOG_LEVEL')
  public logLever: LevelWithSilent = 'info';
}

export const appConfig = ConfigBuilder.from(AppConfig, APP_CONFIG)
  .validate((c) => typia.misc.assertPrune<IAppConfig>(c))
  .build();
