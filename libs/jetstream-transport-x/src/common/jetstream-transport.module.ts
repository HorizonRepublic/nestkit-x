import { DynamicModule, Module } from '@nestjs/common';
import { IJetstreamTransportOptions } from './types';
import { JetstreamServerModule } from '../server';

@Module({})
// todo: add async registration
export class JetstreamTransportModule {
  public static registerServer(options: IJetstreamTransportOptions): DynamicModule {
    return {
      module: JetstreamTransportModule,
      imports: [JetstreamServerModule.register(options)],
    };
  }

  public static registerClient(options: IJetstreamTransportOptions): DynamicModule {
    return {
      module: JetstreamTransportModule,
      imports: [
        /* todo */
      ],
    };
  }

  public static registerAll(options: IJetstreamTransportOptions): DynamicModule {
    return {
      module: JetstreamTransportModule,
      imports: [this.registerServer(options), this.registerClient(options)],
    };
  }
}
