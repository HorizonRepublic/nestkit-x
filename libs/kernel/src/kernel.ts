import 'reflect-metadata';
import { Type } from '@nestjs/common';
import { ConfigFactory, ConfigFactoryKeyHost, ConfigService } from '@nestjs/config';
import { AbstractHttpAdapter, NestFactory } from '@nestjs/core';
import {
  APP_CONFIG,
  APP_REF_SERVICE,
  APP_STATE_SERVICE,
  AppState,
  IAppConfig,
  IAppRefService,
  IAppStateService,
} from '@nestkit-x/core';
import { UltimateExpressAdapter } from '@stigma.io/nestjs-ultimate-express';
import { defer, from, map, Observable, shareReplay, switchMap, tap } from 'rxjs';
import * as UltimateExpress from 'ultimate-express';

import { KernelModule } from './kernel.module';

export class NestKitKernel {
  private static bootstrapResult$?: Observable<NestKitKernel>;
  private static instance?: NestKitKernel;

  private appRef!: IAppRefService;
  private appState!: IAppStateService;

  public static init(
    appModule: Type<unknown>,
    cfg: ConfigFactory & ConfigFactoryKeyHost<IAppConfig>,
  ): Observable<NestKitKernel> {
    const kernel = (this.instance ??= new NestKitKernel());

    if (this.bootstrapResult$) return this.bootstrapResult$;

    this.bootstrapResult$ = kernel.bootstrap$(appModule, cfg).pipe(
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
    appModule: Type<unknown>,
    cfg: ConfigFactory & ConfigFactoryKeyHost<IAppConfig>,
  ): Observable<void> {
    const ultimateExpressInstance = UltimateExpress({ threads: 0 });

    const adapter = new UltimateExpressAdapter(ultimateExpressInstance) as AbstractHttpAdapter;

    const appFactory = NestFactory.create(KernelModule.forRoot(appModule, cfg), adapter, {
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
