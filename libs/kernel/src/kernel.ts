import 'reflect-metadata';
import { Logger, Type } from '@nestjs/common';
import { ConfigFactory, ConfigFactoryKeyHost, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { defer, from, map, Observable, shareReplay, switchMap, tap } from 'rxjs';
import { v7 } from 'uuid';

import { APP_CONFIG, APP_REF_SERVICE, APP_STATE_SERVICE, AppState } from './const';
import { KernelModule } from './kernel.module';
import { IAppConfig, IAppRefService, IAppStateService } from './types';

export class NestKitKernel {
  private static bootstrapResult$?: Observable<NestKitKernel>;
  private static instance?: NestKitKernel;

  private appRef!: IAppRefService;
  private appState!: IAppStateService;

  private readonly logger = new Logger(NestKitKernel.name);

  public static init(
    module: Type<unknown>,
    cfg: ConfigFactory & ConfigFactoryKeyHost<IAppConfig>,
  ): Observable<NestKitKernel> {
    const kernel = (this.instance ??= new NestKitKernel());

    if (this.bootstrapResult$) return this.bootstrapResult$;

    this.bootstrapResult$ = kernel.bootstrap$(module, cfg).pipe(
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

  private bootstrap$(
    module: Type<unknown>,
    cfg: ConfigFactory & ConfigFactoryKeyHost<IAppConfig>,
  ): Observable<void> {
    const appFactory = NestFactory.create<NestFastifyApplication>(
      KernelModule.forRoot(module, cfg),
      new FastifyAdapter({
        genReqId: (): string => v7(),
      }),
      {
        abortOnError: false,
        autoFlushLogs: true,
        bufferLogs: true,
      },
    );

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

  private listen$(): Observable<void> {
    return defer(() => {
      const app = this.appRef.get();
      const cfg = app.get(ConfigService).getOrThrow<IAppConfig>(APP_CONFIG);

      return from(app.listen(cfg.port, cfg.host)).pipe(
        switchMap(() => this.appState.setState$(AppState.Listening)),
      );
    });
  }
}
