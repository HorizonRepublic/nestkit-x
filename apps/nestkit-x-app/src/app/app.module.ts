import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestKitConfigModule } from '@nestkit-x/config';
import { Environment } from '@nestkit-x/core';
import { NestKitLoggerModule } from '@nestkit-x/logger';

import { appConfig } from '../configs/app.config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forFeature(appConfig),
    NestKitConfigModule.forRoot({ generateExampleIn: Environment.Local }),
    NestKitLoggerModule.forRoot(),
  ],
  providers: [AppService],
})
export class AppModule {}
