import { Module } from '@nestjs/common';
import { LoggerModule } from '@zerly/logger';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SubModule } from './submodule/sub.module';
import { AuthModule } from '@zerly/auth-module';

@Module({
  controllers: [AppController],
  imports: [
    LoggerModule.forRoot(),

    // modules
    AuthModule.forHttp(),

    // app layer
    SubModule,
  ],
  providers: [AppService],
})
export class AppModule {}
