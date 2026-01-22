import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_REF_SERVICE, APP_STATE_SERVICE, IAppRefService, IAppStateService } from '@zerly/core';
import { KernelProvider } from './providers/kernel.provider';
import { AppRefService } from './services/app-ref.service';
import { AppStateService } from './services/app-state.service';

@Module({})
export class KernelModule {
  public static forRoot(appModule: Type<unknown>): DynamicModule {
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
      imports: [ConfigModule.forRoot({ cache: true, isGlobal: false }), appModule],
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
      ],
    };
  }
}
