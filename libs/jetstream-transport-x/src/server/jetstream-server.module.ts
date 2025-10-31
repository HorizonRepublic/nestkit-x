import { DynamicModule, Module, Provider } from '@nestjs/common';
import { JetstreamTransport } from './jetstream.transport';
import { JetstreamStrategy } from './jetstream.strategy';
import { IJetstreamTransportOptions } from '../common/types';
import { ConnectionProvider } from '../common/connection.provider';
import { StreamProvider } from './providers/stream.provider';
import { ConsumerProvider } from './providers/consumer.provider';
import { MessageProvider } from './providers/message.provider';
import { MessageRoutingProvider } from './providers/message-routing.provider';
import { PatternRegistry } from './pattern-registry';
import { ServiceType } from '../common/enum/service-type.enum';
import { getJetStreamOptionsToken, getJetStreamTransportToken, getToken } from '../common/helpers';

@Module({})
export class JetstreamServerModule {
  public static forRoot(options: Omit<IJetstreamTransportOptions, 'serviceType'>): DynamicModule {
    return {
      module: JetstreamServerModule,
      providers: [
        {
          provide: getJetStreamOptionsToken(options.name),
          useValue: {
            ...options,
            name: `${options.name}__microservice`,
            serviceType: ServiceType.Consumer,
          },
        } satisfies Provider<IJetstreamTransportOptions>,

        {
          provide: getJetStreamTransportToken(options.name),
          inject: [getJetStreamOptionsToken(options.name), getToken.strategy(options.name)],
          useFactory: (
            options: IJetstreamTransportOptions,
            strategy: JetstreamStrategy,
          ): JetstreamTransport => {
            return new JetstreamTransport(options, strategy);
          },
        } satisfies Provider<JetstreamTransport>,

        {
          provide: getToken.stream(options.name),
          inject: [getJetStreamOptionsToken(options.name), getToken.connection(options.name)],
          useFactory: (
            options: IJetstreamTransportOptions,
            connection: ConnectionProvider,
          ): StreamProvider => {
            return new StreamProvider(options, connection);
          },
        } satisfies Provider<StreamProvider>,

        {
          provide: getToken.consumer(options.name),
          inject: [
            getJetStreamOptionsToken(options.name),
            getToken.connection(options.name),
            getToken.stream(options.name),
          ],
          useFactory: (
            options: IJetstreamTransportOptions,
            connection: ConnectionProvider,
            stream: StreamProvider,
          ) => new ConsumerProvider(options, connection, stream),
        } satisfies Provider<ConsumerProvider>,

        {
          provide: getToken.connection(options.name),
          inject: [getJetStreamOptionsToken(options.name)],
          useFactory: (options: IJetstreamTransportOptions) => new ConnectionProvider(options),
        } satisfies Provider<ConnectionProvider>,

        {
          provide: getToken.strategy(options.name),
          inject: [
            getToken.connection(options.name),
            getToken.stream(options.name),
            getToken.consumer(options.name),
          ],
          useFactory: (
            connection: ConnectionProvider,
            stream: StreamProvider,
            consumer: ConsumerProvider,
          ) => new JetstreamStrategy(connection, stream, consumer),
        } satisfies Provider<JetstreamStrategy>,

        {
          provide: getToken.patternRegistry(options.name),
          inject: [getJetStreamOptionsToken(options.name), getToken.strategy(options.name)],
          useFactory: (
            options: IJetstreamTransportOptions,
            strategy: JetstreamStrategy,
          ): PatternRegistry => {
            return new PatternRegistry(options, strategy);
          },
        } satisfies Provider<PatternRegistry>,

        {
          provide: getToken.message(options.name),
          inject: [getToken.connection(options.name), getToken.consumer(options.name)],
          useFactory: (
            connection: ConnectionProvider,
            consumer: ConsumerProvider,
          ): MessageProvider => {
            return new MessageProvider(connection, consumer);
          },
        } satisfies Provider<MessageProvider>,

        {
          provide: getToken.messageRouting(options.name),
          inject: [
            getToken.connection(options.name),
            getToken.message(options.name),
            getToken.patternRegistry(options.name),
          ],
          useFactory: (
            connection: ConnectionProvider,
            message: MessageProvider,
            patternRegistry: PatternRegistry,
          ) => new MessageRoutingProvider(connection, message, patternRegistry),
        } satisfies Provider<MessageRoutingProvider>,
      ],

      exports: [getJetStreamTransportToken(options.name)],
    };
  }

  // todo:
  public static forRootAsync(): DynamicModule {
    return {
      module: JetstreamServerModule,
    };
  }
}
