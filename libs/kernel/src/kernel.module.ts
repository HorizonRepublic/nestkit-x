import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ConfigFactory, ConfigFactoryKeyHost, ConfigModule } from '@nestjs/config';
import {
  APP_REF_SERVICE,
  APP_STATE_SERVICE,
  IAppConfig,
  IAppRefService,
  IAppStateService,
} from '@nestkit-x/core';

import { CompressionProvider } from './providers/compression.provider';
import { EnvExampleProvider } from './providers/env-example.provider';
import { KernelProvider } from './providers/kernel.provider';
import { AppRefService } from './services/app-ref.service';
import { AppStateService } from './services/app-state.service';

const sharedServices: [Provider<IAppRefService>, Provider<IAppStateService>] = [
  {
    provide: APP_REF_SERVICE,
    useClass: AppRefService,
  },
  {
    provide: APP_STATE_SERVICE,
    useClass: AppStateService,
  },
];

@Module({})
export class KernelModule {
  public static forRoot(
    appModule: Type<unknown>,
    appConfig: ConfigFactory & ConfigFactoryKeyHost<IAppConfig>,
  ): DynamicModule {
    return {
      exports: sharedServices,
      global: true,
      imports: [
        ConfigModule.forRoot({
          cache: true,
          isGlobal: false,
          load: [appConfig],
        }),

        // register client core module
        appModule,
      ],
      module: KernelModule,
      providers: [...sharedServices, KernelProvider, EnvExampleProvider, CompressionProvider],
    };
  }
}
