import { Logger, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { RuntimeException } from '@nestjs/core/errors/exceptions';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { defer, from, map, Observable, shareReplay, switchMap, tap } from 'rxjs';

import { APP_CONFIG, APP_REF_SERVICE, APP_STATE_SERVICE, AppState } from './const';
import { createAppConfig } from './helpers/create-app-config';
import { KernelModule } from './kernel.module';
import { IAppConfig, IAppRefService, IAppStateService } from './types';

export class Kernel {
  private static bootstrapResult$?: Observable<Kernel>;
  private static instance?: Kernel;

  private appRef!: IAppRefService;
  private appState!: IAppStateService;

  private readonly logger = new Logger(Kernel.name);

  public static init(module: Type<unknown>, cfg: IAppConfig): Observable<Kernel> {
    const kernel = (this.instance ??= new Kernel());

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

  private bootstrap$(module: Type<unknown>, cfg: IAppConfig): Observable<void> {
    const configFactory = createAppConfig(cfg);

    const appFactory = NestFactory.create<NestFastifyApplication>(
      KernelModule.forRoot(module, configFactory),
      new FastifyAdapter(),
      { bufferLogs: false },
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
      const cfg = app.get(ConfigService).get<IAppConfig>(APP_CONFIG);

      if (!cfg) throw new RuntimeException('Config is not defined.');

      return from(app.listen(cfg.port, cfg.host)).pipe(
        switchMap(() => this.appState.setState$(AppState.Listening)),
      );
    });
  }
}
