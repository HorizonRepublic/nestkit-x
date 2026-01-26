import { DynamicModule, Module } from '@nestjs/common';
import { IMicroserviceModuleOptions } from './types/microservice-module.options';
import { JetstreamClientModule } from '@horizon-republic/nestjs-jetstream';

@Module({})
export class MicroserviceClientModule {
  public static forRoot(options: IMicroserviceModuleOptions): DynamicModule {
    return {
      module: MicroserviceClientModule,
      imports: [JetstreamClientModule.forFeature(options)],
    };
  }
}
