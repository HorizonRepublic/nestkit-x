import { APP_CONFIG, Environment, IAppConfig } from '@zerly/core';
import { ConfigBuilder, Env } from '@zerly/config';
import typia from 'typia';

class AppConfig implements IAppConfig {
  @Env('APP_ENV')
  public readonly env!: Environment;

  @Env('APP_HOST')
  public readonly host!: string;

  @Env('APP_NAME')
  public readonly name!: string;

  @Env('APP_PORT', { type: Number })
  public readonly port!: number;

  @Env('APP_GENERATE_ENV_EXAMPLE', { type: Boolean })
  public generateEnvExample = true;
}

export const appConfig = ConfigBuilder.from(AppConfig, APP_CONFIG)
  .validate((c) => typia.misc.assertPrune<IAppConfig>(c))
  .build();
