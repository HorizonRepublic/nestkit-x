import { ConsumerConfig, StreamConfig } from 'nats';
import { ConnectionOptions, JetStreamOptions } from 'nats/lib/src/nats-base-client';
import { JsKind } from '../const/enum';

export interface IJetstreamTransportOptions {
  serviceName: string;

  connectionOptions: ConnectionOptions;

  jetstreamOptions?: JetStreamOptions;

  streamConfig?: {
    [JsKind.Command]?: Partial<StreamConfig>;
    [JsKind.Event]?: Partial<StreamConfig>;
  };

  consumerConfig?: {
    [JsKind.Command]?: Partial<ConsumerConfig>;
    [JsKind.Event]?: Partial<ConsumerConfig>;
  };
}
