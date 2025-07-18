import { from, map, merge, Observable, switchMap } from 'rxjs';
import { NatsConnection } from 'nats';
import { LoggerService } from '@nestjs/common';

import { JsKind } from '../const/enum';
import { JsConsumerManager } from './js.consumer-manager';
import { JetStreamStreamManager } from './js.stream-manager';
import { JsPullRunner } from './js.pull-runner';
import { JsMsgManager } from './js.msg-manager';

/**
 * Supervises JetStream consumer lifecycle and coordinates message pull operations.
 *
 * Orchestrates the creation and management of consumer pull loops for both Event
 * and Command streams. Handles consumer setup, JetStream consumer retrieval, and
 * delegates message processing to pull runners with appropriate configurations.
 */
export class JsConsumerSupervisor {
  /**
   * Initializes supervisor with required managers and configuration.
   *
   * @param consumerMgr - Consumer manager for creation and lifecycle
   * @param streamMgr - Stream manager for stream name resolution
   * @param conn$ - Observable of NATS connection for consumer retrieval
   * @param pullTimeoutMs - Timeout for pull operations
   * @param logger - Logger service for operation tracking
   * @param msgMgr - Message manager for handling incoming messages
   */
  constructor(
    private readonly consumerMgr: JsConsumerManager,
    private readonly streamMgr: JetStreamStreamManager,
    private readonly conn$: Observable<NatsConnection>,
    private readonly pullTimeoutMs: number,
    private readonly logger: LoggerService,
    private readonly msgMgr: JsMsgManager,
  ) {}

  /**
   * Starts pull loops for specified stream types.
   *
   * Creates and runs pull operations for Event and/or Command streams based on
   * provided flags. Each stream type runs independently with appropriate RPC
   * handling configuration.
   *
   * @param event - Whether to start Event stream pull loop
   * @param command - Whether to start Command stream pull loop
   * @returns Observable that runs pull operations until completion
   */
  run(event: boolean, command: boolean): Observable<void> {
    const collectFlows = (): Observable<void>[] => {
      const flows: Observable<void>[] = [];

      if (event) flows.push(this.start(JsKind.Event, false));
      if (command) flows.push(this.start(JsKind.Command, true));

      return flows;
    };

    const flows = collectFlows();

    return merge(...flows).pipe(map(() => void 0));
  }

  /**
   * Starts pull loop for specific stream kind with RPC configuration.
   *
   * Sets up consumer, retrieves JetStream consumer instance, and creates pull
   * runner with message handling delegation. The flow ensures proper consumer
   * setup before starting message processing.
   *
   * @param kind - Stream type to start pulling from
   * @param ackRpc - Whether to handle RPC-style acknowledgments
   * @returns Observable that runs pull operations for the stream
   */
  private start(kind: JsKind, ackRpc: boolean): Observable<void> {
    const getJetStreamConsumer = (ci: any) =>
      this.conn$.pipe(switchMap((c) => from(c.jetstream().consumers.get(ci.stream_name, ci.name))));

    const createPullRunner = (consumer: any) =>
      JsPullRunner.create(consumer, {
        expiresMs: this.pullTimeoutMs,
        handle: (msg) => this.msgMgr.handle(msg, ackRpc),
      }).run();

    return this.consumerMgr
      .ensure(this.streamMgr.getStreamName(kind), kind)
      .pipe(switchMap(getJetStreamConsumer), switchMap(createPullRunner));
  }
}
