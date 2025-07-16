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

@Module({
  controllers: [AppController, AppMicroController],
  imports: [
    ConfigModule.forFeature(appConfig),
    NestKitConfigModule.forRoot({ exampleGenerationEnv: Environment.Local }),
    NestKitLoggerModule.forRoot(),
    NestKitMicroserviceServerModule.forRoot({
      servers: ['localhost:4222'],
      serviceName: 'test-service',
    }),
  ],
  providers: [AppService],
})
export class AppModule {}
