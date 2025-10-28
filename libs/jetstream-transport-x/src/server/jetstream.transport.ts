import { CustomStrategy } from '@nestjs/microservices';
import { JetstreamStrategy } from './jetstream.strategy';
import { Inject, Injectable } from '@nestjs/common';
import { JETSTREAM_TRANSPORT_OPTIONS } from '../const';
import { IJetstreamTransportOptions } from './types/jetstream-transport.options';

@Injectable()
export class JetstreamTransport implements CustomStrategy {
  public constructor(
    @Inject(JETSTREAM_TRANSPORT_OPTIONS)
    public readonly options: IJetstreamTransportOptions,

    public readonly strategy: JetstreamStrategy,
  ) {}
}
