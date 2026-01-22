import 'reflect-metadata';
import { Type } from '@nestjs/common';
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
import { FastifyAdapter } from '@nestjs/platform-fastify';

export class Kernel {
  private static bootstrapResult$?: Observable<Kernel>;
  private static instance?: Kernel;

  private appRef!: IAppRefService;
  private appState!: IAppStateService;

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

  private bootstrap$(appModule: Type<unknown>): Observable<void> {
    const adapter = new FastifyAdapter() as AbstractHttpAdapter;

    const appFactory = NestFactory.create(KernelModule.forRoot(appModule), adapter, {
      abortOnError: false,
      autoFlushLogs: true,
      bufferLogs: true,
    });

    return defer(() => from(appFactory)).pipe(
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
