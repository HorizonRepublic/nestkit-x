import { CustomStrategy } from '@nestjs/microservices';
import { JetstreamStrategy } from './jetstream.strategy';
import { Inject, Injectable } from '@nestjs/common';
import { JETSTREAM_TRANSPORT_OPTIONS } from '../common/const';
import { IJetstreamTransportOptions } from '../common/types';

@Injectable()
export class JetstreamTransport implements CustomStrategy {
  public constructor(
    @Inject(JETSTREAM_TRANSPORT_OPTIONS)
    public readonly options: IJetstreamTransportOptions,
    public readonly strategy: JetstreamStrategy,
  ) {}
}
