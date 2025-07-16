import { TransportId } from '@nestjs/microservices';
import { CustomTransportStrategy } from '@nestjs/microservices/interfaces/custom-transport-strategy.interface';

export abstract class JetstreamStrategy implements CustomTransportStrategy {
  public readonly transportId?: TransportId;

  public abstract close(): never;

  public abstract listen(): never;
}
