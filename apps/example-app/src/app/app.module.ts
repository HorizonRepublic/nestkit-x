import { Module } from '@nestjs/common';
import { NestKitLoggerModule } from '@zerly/logger';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppMicroController } from './app.micro-controller';
import { NestKitMicroserviceServerModule } from '@zerly/microservice';
import { JetstreamClientModule } from '@horizon-republic/nestjs-jetstream';
import { SubModule } from './submodule/sub.module';
import { NestKitConfigModule } from '@zerly/config';
import { appConfig } from '../configs/app.config';

@Module({
  controllers: [AppController, AppMicroController],
  imports: [
    // server
    JetstreamClientModule.forFeature({
      servers: ['localhost:4222'],
      name: 'test-service',
    }),

    NestKitConfigModule.forFeature(appConfig),

    NestKitLoggerModule.forRoot(),

    NestKitMicroserviceServerModule.forRoot({
      servers: ['localhost:4222'],
      name: 'test-service',
    }),

    // app layer
    SubModule,
  ],
  providers: [AppService],
})
export class AppModule {}
