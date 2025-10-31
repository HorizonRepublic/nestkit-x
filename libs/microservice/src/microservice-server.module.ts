import { DynamicModule, Module } from '@nestjs/common';

import { MICROSERVICE_OPTIONS } from './const';
import { MicroserviceServerProvider } from './providers/microservice-server.provider';
import { IMicroserviceModuleOptions } from './types/microservice-module.options';
import { JetstreamTransportModule } from '@nestkit-x/jetstream-transport-x';

@Module({})
export class NestKitMicroserviceServerModule {
  public static forRoot(options: IMicroserviceModuleOptions): DynamicModule {
    return {
      module: NestKitMicroserviceServerModule,
      imports: [JetstreamTransportModule.registerServer(options)],
      providers: [
        {
          provide: MICROSERVICE_OPTIONS,
          useValue: options,
        },

        MicroserviceServerProvider,
      ],
    };
  }

  public forRootAsync(): DynamicModule {
    return {
      module: NestKitMicroserviceServerModule,
    };
  }
}
