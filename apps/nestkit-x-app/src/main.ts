import { NestKitKernel } from '@nestkit-x/kernel';

import { AppModule } from './app/app.module';

NestKitKernel.init(AppModule);
