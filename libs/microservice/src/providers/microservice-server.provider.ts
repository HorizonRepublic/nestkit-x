import { INestApplication, Inject, Injectable, Logger } from '@nestjs/common';
import { CustomStrategy } from '@nestjs/microservices';
import { APP_STATE_SERVICE, IAppStateService } from '@nestkit-x/core';
import { JetstreamTransport } from '@nestkit-x/jetstream-transport';
import { from, map, Observable } from 'rxjs';

import { MICROSERVICE_OPTIONS } from '../const';
import { IMicroserviceModuleOptions } from '../types/microservice-module.options';

@Injectable()
export class MicroserviceServerProvider {
  private readonly logger = new Logger(MicroserviceServerProvider.name);

  public constructor(
    @Inject(APP_STATE_SERVICE)
    private readonly stateService: IAppStateService,
    @Inject(MICROSERVICE_OPTIONS)
    private readonly options: IMicroserviceModuleOptions,
  ) {
    this.stateService.onCreated((app): Observable<void> => {
      return this.serveMicroservice(app);
    });
  }

  private serveMicroservice(app: INestApplication): Observable<void> {
    const strategy = new JetstreamTransport();

    console.log('OPTIONS', this.options);

    app.connectMicroservice<CustomStrategy>(strategy, { inheritAppConfig: true });

    return from(app.startAllMicroservices()).pipe(map(() => void 0));
  }
}
