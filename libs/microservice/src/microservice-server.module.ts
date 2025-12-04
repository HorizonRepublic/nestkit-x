import { DynamicModule, Module } from '@nestjs/common';

import { MICROSERVICE_OPTIONS } from './const';
import { MicroserviceServerProvider } from './providers/microservice-server.provider';
import { IMicroserviceModuleOptions } from './types/microservice-module.options';
import { JetstreamServerModule } from '@horizon-republic/nestjs-jetstream';

@Module({})
export class NestKitMicroserviceServerModule {
  public static forRoot(options: IMicroserviceModuleOptions): DynamicModule {
    return {
      module: NestKitMicroserviceServerModule,
      imports: [JetstreamServerModule.forRoot(options)],
      providers: [
        {
          provide: MICROSERVICE_OPTIONS,
          useValue: options,
        },

        MicroserviceServerProvider,
      ],
    };
  }

  // todo: make really async
  public forRootAsync(options: IMicroserviceModuleOptions): DynamicModule {
    return {
      module: NestKitMicroserviceServerModule,
      imports: [
        JetstreamServerModule.forRootAsync({
          name: options.name,
          imports: [],
          useFactory: async () => ({
            name: options.name,
            servers: options.servers,
          }),
          inject: [],
        }),
      ],
      providers: [
        {
          provide: MICROSERVICE_OPTIONS,
          useValue: options,
        },

        MicroserviceServerProvider,
      ],
    };
  }
}
