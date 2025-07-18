import { JetstreamEvent } from '../const/enum';
import { NatsConnection } from 'nats';

/**
 * Type-safe event map for JetStream transport events.
 * Defines callback signatures for each event type.
 */
export interface IJetstreamEventsMap {
  [JetstreamEvent.Connecting](): void;
  [JetstreamEvent.Connected](conn: NatsConnection): void;
  [JetstreamEvent.Reconnected](conn: NatsConnection): void;
  [JetstreamEvent.Disconnected](): void;
  [JetstreamEvent.Error](err: unknown): void;
  [JetstreamEvent.JetStreamAttached](): void;
}
