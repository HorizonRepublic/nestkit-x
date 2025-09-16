import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestKitConfigModule } from '@nestkit-x/config';
import { Environment } from '@nestkit-x/core';
import { NestKitLoggerModule } from '@nestkit-x/logger';
import { NestKitMicroserviceServerModule } from '@nestkit-x/microservice';

import { appConfig } from '../configs/app.config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppMicroController } from './app.micro-controller';
import { JetstreamClientsModule } from '@nestkit-x/jetstream-transport';

@Module({
  controllers: [AppController, AppMicroController],
  imports: [
    ConfigModule.forFeature(appConfig),

    JetstreamClientsModule.forRoot([
      {
        connectionOptions: {
          servers: ['localhost:4222'],
        },
        serviceName: 'test-service',
      },
    ]),

    NestKitConfigModule.forRoot({ exampleGenerationEnv: Environment.Local }),

    // server
    NestKitLoggerModule.forRoot(),

    NestKitMicroserviceServerModule.forRoot({
      servers: ['localhost:4222'],
      serviceName: 'test-service',
    }),
  ],
  providers: [AppService],
})
export class AppModule {}
