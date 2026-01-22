import { Module } from '@nestjs/common';
import { SubService } from './sub.service';
import { NestKitConfigModule } from '@zerly/config';
import { appConfig } from '../../configs/app.config';

@Module({
  imports: [NestKitConfigModule.forFeature(appConfig)],
  providers: [SubService],
})
export class SubModule {}
