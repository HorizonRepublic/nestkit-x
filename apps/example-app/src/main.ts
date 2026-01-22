import { NestKitKernel } from '@zerly/kernel';

import { AppModule } from './app/app.module';

NestKitKernel.init(AppModule);
