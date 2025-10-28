import { INestApplication, Inject, Injectable, Logger } from '@nestjs/common';
import { APP_STATE_SERVICE, IAppStateService } from '@nestkit-x/core';
import { from, map, Observable } from 'rxjs';

import { MICROSERVICE_OPTIONS } from '../const';
import { IMicroserviceModuleOptions } from '../types/microservice-module.options';
import { JETSTREAM_TRANSPORT } from '@nestkit-x/jetstream-transport-x';
import { CustomStrategy } from '@nestjs/microservices';
import { Events } from 'nats';

@Injectable()
export class MicroserviceServerProvider {
  private readonly logger = new Logger(MicroserviceServerProvider.name);

  public constructor(
    @Inject(APP_STATE_SERVICE)
    private readonly stateService: IAppStateService,
    @Inject(MICROSERVICE_OPTIONS)
    private readonly options: IMicroserviceModuleOptions,
  ) {
    this.stateService.onListening((app): Observable<void> => {
      return this.serveMicroservice(app);
    });
  }

  private serveMicroservice(app: INestApplication): Observable<void> {
    const transport = app.get<CustomStrategy>(JETSTREAM_TRANSPORT);

    const microservice = app.connectMicroservice<CustomStrategy>(transport, {
      inheritAppConfig: true,
    });

    microservice.on(Events.Reconnect, () => {
      this.logger.log('(client log) Reconnected to NATS');
    });

    return from(app.startAllMicroservices()).pipe(map(() => void 0));
  }
}
