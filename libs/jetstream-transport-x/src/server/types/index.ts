import { StreamConfig } from 'nats/lib/jetstream/jsapi_types';
import { JetStreamKind } from '../../enum';

export type StreamConfigRecord = {
  base: StreamConfig;
} & {
  [K in JetStreamKind]: Partial<StreamConfig>;
};
