import { Module } from '@nestjs/common';
import { NestKitLoggerModule } from '@zerly/logger';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SubModule } from './submodule/sub.module';

@Module({
  controllers: [AppController],
  imports: [
    NestKitLoggerModule.forRoot(),

    // app layer
    SubModule,
  ],
  providers: [AppService],
})
export class AppModule {}
