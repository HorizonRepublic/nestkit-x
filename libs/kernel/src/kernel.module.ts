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

@Module({})
export class KernelModule {
  public static forRoot(
    appModule: Type<unknown>,
    appConfig: ConfigFactory & ConfigFactoryKeyHost<IAppConfig>,
  ): DynamicModule {
    return {
      exports: [
        {
          provide: APP_REF_SERVICE,
          useClass: AppRefService,
        } satisfies Provider<IAppRefService>,

        {
          provide: APP_STATE_SERVICE,
          useClass: AppStateService,
        } satisfies Provider<IAppStateService>,
      ],
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
      providers: [
        {
          provide: APP_STATE_SERVICE,
          useClass: AppStateService,
        } satisfies Provider<IAppStateService>,

        {
          provide: APP_REF_SERVICE,
          useClass: AppRefService,
        } satisfies Provider<IAppRefService>,

        KernelProvider,
        EnvExampleProvider,
        CompressionProvider,
      ],
    };
  }
}
