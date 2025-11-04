import { DynamicModule, Module } from '@nestjs/common';
import { JetstreamClientModule } from '@nestkit-x/jetstream-transport-x';
import { IMicroserviceModuleOptions } from './types/microservice-module.options';

@Module({})
export class NestKitMicroserviceClientModule {
  public static forRoot(options: IMicroserviceModuleOptions): DynamicModule {
    return {
      module: NestKitMicroserviceClientModule,
      imports: [JetstreamClientModule.forFeature(options)],
    };
  }
}
