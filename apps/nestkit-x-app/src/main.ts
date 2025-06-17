import { NestKitKernel } from '@nestkit-x/kernel';

import { AppModule } from './app/app.module';
import { appConfig } from './configs/app.config';

NestKitKernel.init(AppModule, appConfig);
