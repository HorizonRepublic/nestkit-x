// jetstream-clients.module.ts
import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { JetstreamClient } from './jetstream.client';
import { IJetStreamClientOptions } from './types';
import { createJetstreamToken } from './helpers';

@Module({})
export class JetstreamClientsModule {
  public static forRoot(entries: IJetStreamClientOptions[]): DynamicModule {
    // формуємо параметри для ClientsModule.register()
    const mapped = entries.map((e) => ({
      name: createJetstreamToken(e.serviceName), // DI‑токен
      customClass: JetstreamClient, // наш клас
      options: e,
    }));

    return {
      global: true,
      module: JetstreamClientsModule,
      imports: [ClientsModule.register(mapped)],
      exports: [ClientsModule], // даємо назовні DI‑токени
    };
  }
}
