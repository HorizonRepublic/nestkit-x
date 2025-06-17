import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ConfigFactoryKeyHost, ConfigModule } from '@nestjs/config';

import { APP_REF_SERVICE, APP_STATE_SERVICE } from './const';
import { KernelProvider } from './providers/kernel.provider';
import { AppRefService } from './services/app-ref.service';
import { AppStateService } from './services/app-state.service';
import { IAppConfig, IAppRefService, IAppStateService } from './types';

const providers: [Provider<IAppRefService>, Provider<IAppStateService>] = [
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
    module: Type<unknown>,
    appConfig: (() => IAppConfig) & ConfigFactoryKeyHost<IAppConfig>,
  ): DynamicModule {
    return {
      exports: providers,
      global: true,
      imports: [ConfigModule.forRoot({ cache: true, load: [appConfig] }), module],
      module: KernelModule,
      providers: [...providers, KernelProvider],
    };
  }
}
