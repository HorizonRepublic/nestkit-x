import 'reflect-metadata';
import { Logger, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AbstractHttpAdapter, NestFactory } from '@nestjs/core';
import {
  APP_CONFIG,
  APP_REF_SERVICE,
  APP_STATE_SERVICE,
  AppState,
  IAppConfig,
  IAppRefService,
  IAppStateService,
} from '@zerly/core';
import { defer, from, map, Observable, of, shareReplay, switchMap, tap } from 'rxjs';

import { KernelModule } from './kernel.module';
import { getRuntime } from './helpers/get-runtime.helper';
import type { FastifyAdapter } from '@nestjs/platform-fastify';
import { Runtime } from './enum/runtime.enum';
import type { BunAdapter } from '@krisanalfa/bunest-adapter';

export class Kernel {
  private static bootstrapResult$?: Observable<Kernel>;
  private static instance?: Kernel;

  private appRef!: IAppRefService;
  private appState!: IAppStateService;
  private readonly logger = new Logger(Kernel.name);

  public static init(appModule: Type<unknown>): Observable<Kernel> {
    const kernel = (this.instance ??= new Kernel());

    if (this.bootstrapResult$) return this.bootstrapResult$;

    this.bootstrapResult$ = kernel.bootstrap$(appModule).pipe(
      map(() => kernel),
      shareReplay(1),
    );

    this.bootstrapResult$.subscribe({
      error: (err) => {
        console.error('Kernel bootstrap failed:', err);
        process.exit(1);
      },
    });

    return this.bootstrapResult$;
  }

  public static standalone(appModule: Type<unknown>): Observable<Kernel> {
    const kernel = new Kernel();

    const bootstrap$ = kernel.bootstrapStandalone$(appModule).pipe(
      map(() => kernel),
      shareReplay(1),
    );

    bootstrap$.subscribe({
      error: (err) => {
        console.error('Standalone app bootstrap failed:', err);
        process.exit(1);
      },
    });

    return bootstrap$;
  }

  private async getAdapter(): Promise<AbstractHttpAdapter> {
    const runtime = getRuntime();

    let adapter: unknown;

    if (runtime === Runtime.Bun) adapter = await this.getBunAdapter();

    adapter = await this.getFastifyAdapter();

    return adapter as AbstractHttpAdapter;
  }

  private async getBunAdapter(): Promise<BunAdapter> {
    try {
      const bun = await import('@krisanalfa/bunest-adapter');

      return new bun.BunAdapter();
      // eslint-disable-next-line unused-imports/no-unused-vars,sonarjs/no-ignored-exceptions
    } catch (e) {
      this.logger.error(
        `BunAdapter is missing. Please install it using your package manager:\n` +
          `npm install @krisanalfa/bunest-adapter\n`,
      );

      process.exit(1);
    }
  }

  private async getFastifyAdapter(): Promise<FastifyAdapter> {
    try {
      const fastify = await import('@nestjs/platform-fastify');

      return new fastify.FastifyAdapter();
      // eslint-disable-next-line unused-imports/no-unused-vars,sonarjs/no-ignored-exceptions
    } catch (e) {
      this.logger.error(
        `FastifyAdapter is missing. Please install it using your package manager:\n` +
          `npm add @nestjs/platform-fastify fastify`,
      );

      process.exit(1);
    }
  }

  private bootstrap$(appModule: Type<unknown>): Observable<void> {
    return from(this.getAdapter()).pipe(
      switchMap((adapter) => {
        const appFactory = NestFactory.create(KernelModule.forRoot(appModule), adapter, {
          abortOnError: false,
          autoFlushLogs: true,
          bufferLogs: true,
        });

        return from(appFactory);
      }),

      tap((app) => {
        this.appRef = app.get<IAppRefService>(APP_REF_SERVICE);
        this.appState = app.get<IAppStateService>(APP_STATE_SERVICE);

        this.appRef.set(app);
      }),

      switchMap(() => this.appState.setState$(AppState.Created)),

      switchMap(() => this.listen$()),
    );
  }

  private bootstrapStandalone$(standaloneModule: Type<unknown>): Observable<void> {
    const appFactory = NestFactory.createApplicationContext(
      KernelModule.forRoot(standaloneModule),
      {
        abortOnError: false,
        autoFlushLogs: true,
        bufferLogs: true,
      },
    );

    return defer(() => from(appFactory).pipe(switchMap(() => of(void 0))));
  }

  private listen$(): Observable<void> {
    return defer(() => {
      const app = this.appRef.get();
      const config = app.get(ConfigService).getOrThrow<IAppConfig>(APP_CONFIG);

      return from(app.listen(config.port, config.host)).pipe(
        switchMap(() => this.appState.setState$(AppState.Listening)),
      );
    });
  }
}
