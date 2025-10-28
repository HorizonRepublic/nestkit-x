/* eslint-disable @typescript-eslint/naming-convention */
import {
  AckPolicy,
  DeliverPolicy,
  DiscardPolicy,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
  StoreCompression,
} from 'nats';
import { JetStreamKind } from '../../enum';
import { ConsumerConfigRecord, StreamConfigRecord } from '../types';
import { ConsumerConfig } from 'nats/lib/jetstream/jsapi_types';

// Size constants in bytes
const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

// Time constants in nanoseconds (NATS JetStream format)
const SEC = 1e9;
const MIN = 60 * SEC;
const DAY = 24 * 60 * MIN;

export const streamConfig: StreamConfigRecord = Object.freeze({
  base: {
    name: '',
    subjects: [],
    description: '',
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.File,
    num_replicas: 1,

    // Resource limits
    max_consumers: 0,
    max_msgs_per_subject: 0,
    max_msgs: 0,
    max_age: 0,
    max_bytes: 0,
    max_msg_size: 0,

    // Stream behavior settings
    discard: DiscardPolicy.Old,
    discard_new_per_subject: false,
    duplicate_window: 0,
    first_seq: 0,
    sealed: false,
    mirror_direct: false,
    allow_direct: true,
    allow_rollup_hdrs: false,
    deny_delete: false,
    deny_purge: false,
    compression: StoreCompression.None,
  },

  [JetStreamKind.Event]: {
    allow_rollup_hdrs: true,
    max_consumers: 100,
    max_msg_size: 10 * MB,
    max_msgs_per_subject: 5_000_000,
    max_msgs: 50_000_000,
    max_bytes: 5 * GB,
    max_age: 7 * DAY,
    duplicate_window: 2 * MIN,
  },

  [JetStreamKind.Command]: {
    allow_rollup_hdrs: false,
    max_consumers: 50,
    max_msg_size: 5 * MB,
    max_msgs_per_subject: 100_000,
    max_msgs: 1_000_000,
    max_bytes: 100 * MB,
    max_age: 3 * MIN,
    duplicate_window: 30 * SEC,
  },
});

const RPC_TIMEOUT_MS = 180_000; // 3 minutes
const EVENT_TIMEOUT_MS = 60_000; // 1 minute

const baseConsumerConfig = (
  name: string,
  kind: JetStreamKind,
): Pick<ConsumerConfig, 'name' | 'durable_name' | 'filter_subject'> => {
  return {
    durable_name: `${name}_${kind}-consumer`,
    name: `${name}_${kind}-consumer`,
    filter_subject: `${name}.${kind}.>`,
  };
};

export const consumerConfig: ConsumerConfigRecord = {
  [JetStreamKind.Event]: (name, kind) => ({
    ...baseConsumerConfig(name, kind),
    ack_wait: EVENT_TIMEOUT_MS * 1_000_000,
    max_deliver: 5,
    max_ack_pending: 50,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.All,
    replay_policy: ReplayPolicy.Instant,
  }),

  [JetStreamKind.Command]: (name, kind) => ({
    ...baseConsumerConfig(name, kind),
    ack_wait: RPC_TIMEOUT_MS * 1_000_000,
    max_deliver: 1,
    max_ack_pending: 5,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.All,
    replay_policy: ReplayPolicy.Instant,
  }),
};
