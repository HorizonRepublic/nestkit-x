import { JetstreamEvent } from '@nestkit-x/jetstream-transport';
import { NatsConnection } from 'nats';

export interface IJetstreamEventsMap extends Record<string, Function> {
  [JetstreamEvent.Connecting]: () => void;
  [JetstreamEvent.Connected]: (conn: NatsConnection) => void;
  [JetstreamEvent.Disconnected]: () => void;
  [JetstreamEvent.Error]: (err: unknown) => void;
  [JetstreamEvent.JetStreamAttached]: (err: unknown) => void;
}
