import { DynamicModule, Module } from '@nestjs/common';
import { ConfigFactory, ConfigModule } from '@nestjs/config';
import { EnvExampleProvider } from './providers/env-example.provider';
import { ConfigModuleOptions } from '@nestjs/config/dist/interfaces/config-module-options.interface';

@Module({})
export class ZerlyConfigModule {
  public static forRoot(load: ConfigModuleOptions['load'] = []): DynamicModule {
    return {
      module: ZerlyConfigModule,
      global: false,
      imports: [
        ConfigModule.forRoot({
          cache: true,
          isGlobal: true,
          expandVariables: true,
          load,
        }),
      ],
      providers: [EnvExampleProvider],
      exports: [ConfigModule],
    };
  }

  public static forFeature(config: ConfigFactory): DynamicModule {
    return {
      module: ZerlyConfigModule,
      imports: [ConfigModule.forFeature(config)],
      exports: [ConfigModule],
    };
  }
}
