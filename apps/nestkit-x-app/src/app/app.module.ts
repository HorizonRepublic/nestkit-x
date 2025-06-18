import { ForbiddenException, Module, OnModuleInit } from '@nestjs/common';
import { NestKitLoggerModule } from '@nestkit-x/logger';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  controllers: [AppController],
  imports: [NestKitLoggerModule.forRoot()],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {
  public constructor() {}

  public onModuleInit(): void {
    // throw new ForbiddenException(`Test exception`);
  }
}
