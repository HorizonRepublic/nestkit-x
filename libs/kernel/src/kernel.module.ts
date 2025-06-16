import { DynamicModule, Module, Provider, Type } from '@nestjs/common';

import { AppRefService } from './services/app-ref.service';
import { APP_REF_SERVICE_TOKEN, IAppRefService } from './types';

@Module({})
export class KernelModule {
  public static forRoot(module: Type<unknown>): DynamicModule {
    return {
      imports: [module],
      module: KernelModule,
      providers: [
        {
          provide: APP_REF_SERVICE_TOKEN,
          useClass: AppRefService,
        } satisfies Provider<IAppRefService>,
      ],
    };
  }
}
