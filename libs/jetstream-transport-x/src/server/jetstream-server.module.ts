import { DynamicModule, Module } from '@nestjs/common';
import { JetstreamTransport } from './jetstream.transport';
import { JETSTREAM_TRANSPORT, JETSTREAM_TRANSPORT_OPTIONS } from '../const';
import { JetstreamStrategy } from './jetstream.strategy';
import { IJetstreamTransportOptions } from './types/jetstream-transport.options';
import { ConnectionProvider } from '../common/connection.provider';
import { StreamProvider } from './providers/stream.provider';
import { ConsumerProvider } from './providers/consumer.provider';

@Module({})
export class JetstreamServerModule {
  public static register(options: IJetstreamTransportOptions): DynamicModule {
    return {
      module: JetstreamServerModule,
      providers: [
        {
          provide: JETSTREAM_TRANSPORT_OPTIONS,
          useValue: options,
        },
        {
          provide: JETSTREAM_TRANSPORT,
          useClass: JetstreamTransport,
        },
        JetstreamStrategy,
        ConnectionProvider,
        StreamProvider,
        ConsumerProvider,
      ],

      exports: [JETSTREAM_TRANSPORT],
    };
  }
}
