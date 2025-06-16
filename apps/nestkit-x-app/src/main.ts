/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Kernel } from '@nestkit-x/kernel';

import { AppModule } from './app/app.module';

Kernel.create(AppModule);
