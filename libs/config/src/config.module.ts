import { DynamicModule, Module } from '@nestjs/common';
import { ConfigFactory, ConfigModule } from '@nestjs/config';
import { Environment } from '@nestkit-x/core';

import { CONFIG_MODULE_OPTIONS } from './const';
import { EnvExampleProvider } from './providers/env-example.provider';
import { IConfigModuleOptions } from './types/config-module.options';

@Module({})
export class NestKitConfigModule {
  public static forRoot(
    options: IConfigModuleOptions = {
      exampleGenerationEnv: Environment.Local,
      load: [],
    },
  ): DynamicModule {
    return {
      global: false,
      imports: [
        ConfigModule.forRoot({
          cache: true,
          load: options.load ?? [],
          isGlobal: true,
          expandVariables: true,
        }),
      ],
      module: NestKitConfigModule,
      providers: [
        {
          provide: CONFIG_MODULE_OPTIONS,
          useValue: options,
        },
        EnvExampleProvider,
      ],
    };
  }

  public static forFeature(config: ConfigFactory): DynamicModule {
    return {
      module: NestKitConfigModule,
      imports: [ConfigModule.forFeature(config)],
    };
  }
}
