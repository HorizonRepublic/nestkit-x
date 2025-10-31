import { CustomStrategy } from '@nestjs/microservices';
import { JetstreamStrategy } from './jetstream.strategy';
import { Injectable } from '@nestjs/common';
import { IJetstreamTransportOptions } from '../common/types';

@Injectable()
export class JetstreamTransport implements CustomStrategy {
  public constructor(
    public readonly options: IJetstreamTransportOptions,
    public readonly strategy: JetstreamStrategy,
  ) {}
}
