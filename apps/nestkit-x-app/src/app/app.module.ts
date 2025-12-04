import { Module } from '@nestjs/common';
import { NestKitConfigModule } from '@nestkit-x/config';
import { Environment } from '@nestkit-x/core';
import { NestKitLoggerModule } from '@nestkit-x/logger';

import { appConfig } from '../configs/app.config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppMicroController } from './app.micro-controller';
import { NestKitMicroserviceServerModule } from '@nestkit-x/microservice';
import { JetstreamClientModule } from '@horizon-republic/nestjs-jetstream';

@Module({
  controllers: [AppController, AppMicroController],
  imports: [
    // server
    JetstreamClientModule.forFeature({
      servers: ['localhost:4222'],
      name: 'test-service',
    }),

    NestKitConfigModule.forRoot({ load: [appConfig], exampleGenerationEnv: Environment.Local }),

    NestKitLoggerModule.forRoot(),

    NestKitMicroserviceServerModule.forRoot({
      servers: ['localhost:4222'],
      name: 'test-service',
    }),
  ],
  providers: [AppService],
})
export class AppModule {}
