import {
  AckPolicy,
  Consumer,
  DeliverPolicy,
  DiscardPolicy,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
  StoreCompression,
  StreamConfig,
} from 'nats';
import { catchError, EMPTY, from, map, mergeMap, Observable, of, switchMap } from 'rxjs';
import { JetstreamStrategy } from './jetstream.strategy';
import { getJetstreamDurableName, getJetStreamFilterSubject, getStreamName } from '../helpers';
import { JetstreamConsumerSetup, JetstreamMessageType } from '@nestkit-x/jetstream-transport';

/**
 * JetStream Push Strategy Implementation
 */
export class JetstreamPushStrategy extends JetstreamStrategy {
  /**
   * Sets up the JetStream stream configuration
   */
  protected override setupStream(): Observable<void> {
    const { serviceName } = this.options;

    // todo: make configurable
    const config: StreamConfig = {
      allow_direct: true,
      allow_rollup_hdrs: true,
      discard_new_per_subject: false,
      first_seq: 1,
      mirror_direct: false,

      name: getStreamName(serviceName),
      subjects: this.buildStreamSubjects(),
      storage: StorageType.File,
      retention: RetentionPolicy.Interest,
      max_msgs: 10000,
      max_msgs_per_subject: 1000,
      max_bytes: 100 * 1024 * 1024, // 100MB
      max_age: 24 * 3600 * 1000 * 1000 * 1000, // 24hrs
      duplicate_window: 2 * 60 * 1000 * 1000 * 1000, // 2min

      discard: DiscardPolicy.Old,
      max_msg_size: 1024 * 1024, // 1MB

      num_replicas: 1,
      no_ack: false,

      compression: StoreCompression.None,

      sealed: false,
      deny_delete: false,
      deny_purge: false,

      max_consumers: 100,
      // placement: {
      //   cluster: undefined, // Або назва кластера
      //   tags: [],
      // },

      description: `Stream for ${serviceName} service`,

      // Rollup
      // mirror: undefined,
      // sources: undefined,
    };

    return this.getJetStreamManager().pipe(
      switchMap((jsm) => this.createOrUpdateStream(jsm, config)),
    );
  }

  /**
   * Sets up event handlers for fire-and-forget messaging
   */
  protected override setupEventHandlers(): Observable<void> {
    const { events } = this.getRegisteredPatterns();

    if (events.length === 0) {
      this.logDebug('No event patterns registered, skipping event consumer');
      return of(void 0);
    }

    const config = this.buildEventConsumerConfig();

    return this.createConsumer(config).pipe(
      switchMap((consumer) => this.consumeMessages(consumer, false)),
    );
  }

  /**
   * Sets up message handlers for request-response messaging
   */
  protected override setupMessageHandlers(): Observable<void> {
    const { messages } = this.getRegisteredPatterns();

    if (messages.length === 0) {
      this.logDebug('No message patterns registered, skipping message consumer');
      return of(void 0);
    }

    const config = this.buildMessageConsumerConfig();

    return this.createConsumer(config).pipe(
      switchMap((consumer) => this.consumeMessages(consumer, true)),
    );
  }

  /**
   * Main message consumption loop
   */
  private consumeMessages(consumer: Consumer, isRpc: boolean): Observable<void> {
    const handlerType = isRpc ? 'RPC' : 'Event';

    this.logDebug(`Starting ${handlerType} message consumption`);

    return from(consumer.consume()).pipe(
      switchMap((messageIterator) => from(messageIterator)),
      mergeMap((message) => this.processMessage(message, isRpc)),
      catchError((error) => {
        this.logger.error(`${handlerType} consumer error: ${error.message}`);
        return EMPTY;
      }),
      map(() => void 0),
    );
  }

  /**
   * Builds event consumer configuration
   */
  private buildEventConsumerConfig(): JetstreamConsumerSetup {
    const { serviceName } = this.options;

    return {
      stream: getStreamName(serviceName),
      config: {
        durable_name: getJetstreamDurableName(serviceName, JetstreamMessageType.Event),
        filter_subject: getJetStreamFilterSubject(serviceName, JetstreamMessageType.Event),
        ack_policy: AckPolicy.Explicit,
        max_deliver: 3,
        ack_wait: 30000,
        deliver_policy: DeliverPolicy.All,
        replay_policy: ReplayPolicy.Instant,
      },
    };
  }

  /**
   * Builds message consumer configuration
   */
  private buildMessageConsumerConfig(): JetstreamConsumerSetup {
    const { serviceName } = this.options;

    return {
      stream: getStreamName(serviceName),
      config: {
        durable_name: getJetstreamDurableName(serviceName, JetstreamMessageType.Command),
        filter_subject: getJetStreamFilterSubject(serviceName, JetstreamMessageType.Command),
        ack_policy: AckPolicy.Explicit,
        max_deliver: 3,
        ack_wait: 30000,
        deliver_policy: DeliverPolicy.All,
        replay_policy: ReplayPolicy.Instant,
      },
    };
  }
}
