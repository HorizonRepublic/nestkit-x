import { INestApplication, Inject, Injectable, Logger } from '@nestjs/common';
import { CustomStrategy } from '@nestjs/microservices';
import { APP_STATE_SERVICE, IAppStateService } from '@nestkit-x/core';
import {
  JetstreamEvent,
  JetstreamTransport,
  JsKind,
  JsStreamConfigBuilder,
} from '@nestkit-x/jetstream-transport';
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
    this.stateService.onListening((app): Observable<void> => {
      return this.serveMicroservice(app);
    });
  }

  private serveMicroservice(app: INestApplication): Observable<void> {
    const strategy = new JetstreamTransport({
      serviceName: this.options.serviceName,
      connectionOptions: {
        servers: this.options.servers,
      },
      streamConfig: {
        [JsKind.Command]: JsStreamConfigBuilder.create(this.options.serviceName)
          .forKind(JsKind.Command)
          .with({})
          .build(),

        [JsKind.Event]: JsStreamConfigBuilder.create(this.options.serviceName)
          .forKind(JsKind.Command)
          .with({})
          .build(),
      },
    });

    const microservice = app.connectMicroservice<CustomStrategy>(strategy, {
      inheritAppConfig: true,
    });

    microservice.on(JetstreamEvent.Connected, () => {
      this.logger.log(`Microservice connected to ${this.options.serviceName}`);
    });

    return from(app.startAllMicroservices()).pipe(map(() => void 0));
  }
}
