import { Module } from '@nestjs/common';
import { NestKitLoggerModule } from '@nestkit-x/logger';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  controllers: [AppController],
  imports: [NestKitLoggerModule.forRoot()],
  providers: [AppService],
})
export class AppModule {
  public constructor() {}
}
