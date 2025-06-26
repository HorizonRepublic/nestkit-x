import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Environment } from '@nestkit-x/core';

import { CONFIG_MODULE_OPTIONS } from './const';
import { EnvExampleProvider } from './providers/env-example.provider';
import { IConfigModuleOptions } from './types/i-config-module.options';

@Module({})
export class NestKitConfigModule {
  public static forRoot(
    options: IConfigModuleOptions = { generateExampleIn: Environment.Local },
  ): DynamicModule {
    return {
      imports: [ConfigModule],
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
}
