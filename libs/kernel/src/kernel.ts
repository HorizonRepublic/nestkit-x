import { INestApplication, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { KernelModule } from './kernel.module';
import { APP_REF_SERVICE_TOKEN, IAppRefService } from './types';

// type ApplicationConfig = (() => Promise<IAppConfig>) & ConfigFactoryKeyHost<Promise<IAppConfig>>;

export class Kernel {
  private static instance: Kernel | null = null;

  private constructor() {}

  public static async create(module: Type<unknown>): Promise<Kernel> {
    Kernel.instance ??= new Kernel();

    await Kernel.instance.makeApp(module);

    return Kernel.instance;
  }

  protected async makeApp(module: Type<unknown>): Promise<INestApplication> {
    const app = await NestFactory.create<NestFastifyApplication>(
      KernelModule.forRoot(module),
      new FastifyAdapter(),
    );

    const appRef = app.get<IAppRefService>(APP_REF_SERVICE_TOKEN);

    appRef.set(app);

    return app;
  }
}
