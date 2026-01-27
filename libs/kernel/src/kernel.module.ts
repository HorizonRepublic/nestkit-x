import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { APP_REF_SERVICE, APP_STATE_SERVICE, IAppRefService, IAppStateService } from '@zerly/core';
import { KernelProvider } from './providers/kernel.provider';
import { AppRefService } from './services/app-ref.service';
import { AppStateService } from './services/app-state.service';
import { ConfigModule } from '@zerly/config';
import { appConfig } from './config/app.config';

@Module({})
export class KernelModule {
  /**
   * Used for serving HTTP applications
   *
   * @param appModule
   */
  public static forServe(appModule: Type<unknown>): DynamicModule {
    return {
      global: true,
      imports: [ConfigModule.forRoot([appConfig]), appModule],
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

  /**
   * Used for standalone applications
   *
   * @param appModule
   */
  public static forStandalone(appModule: Type<unknown>): DynamicModule {
    return {
      global: true,
      imports: [appModule],
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
      ],
    };
  }
}
