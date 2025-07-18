import { JetStreamManager, StreamConfig, StreamInfo } from 'nats';
import { catchError, defer, forkJoin, from, map, Observable, switchMap, tap } from 'rxjs';
import { LoggerService } from '@nestjs/common';

import { IJetstreamTransportOptions } from '../types/jetstream-transport.options';
import { JsKind } from '../const/enum';
import { JsStreamConfigBuilder } from '../config-builders/js.stream-config-builder';

/**
 * Manages NATS JetStream streams lifecycle including creation, updates, and verification.
 * Provides high-level API for ensuring stream availability and retrieving stream metadata.
 *
 * This manager handles both Event and Command streams, automatically creating them
 * with appropriate configurations and updating existing streams when needed.
 */
export class JetStreamStreamManager {
  /**
   * Creates a new JetStream stream manager instance.
   *
   * @param jsm$ Observable that emits JetStream manager instances.
   * @param opts JetStream transport configuration options.
   * @param logger Logger service for operation tracking.
   */
  public constructor(
    private readonly jsm$: Observable<JetStreamManager>,
    private readonly opts: IJetstreamTransportOptions,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Ensures both Event and Command streams exist and are properly configured.
   * Creates streams if they don't exist, updates them if the configuration differs.
   *
   * @returns Observable that completes when both streams are ready.
   */
  public ensureAll(): Observable<void> {
    return forkJoin([this.ensure(JsKind.Event), this.ensure(JsKind.Command)]).pipe(
      map(() => void 0),
    );
  }

  /**
   * Ensures a specific stream exists and is properly configured.
   * Creates the stream if it doesn't exist, updates it if configuration differs.
   *
   * @param kind The type of stream to ensure (Event or Command).
   * @returns Observable that completes when the stream is ready.
   */
  public ensure(kind: JsKind): Observable<void> {
    const cfg = this.buildStreamConfig(kind);

    return this.ensureStream(cfg);
  }

  /**
   * Retrieves the stream name for a given stream kind.
   * Used by consumers to identify which stream to subscribe to.
   *
   * @param kind The type of stream.
   * @returns The fully qualified stream name.
   */
  public getStreamName(kind: JsKind): string {
    return this.buildStreamConfig(kind).name;
  }

  /**
   * Builds stream configuration using the builder pattern.
   * Delegates to JsStreamConfigBuilder for consistent configuration generation.
   *
   * @param kind The type of stream to configure.
   * @returns Complete stream configuration object.
   */
  private buildStreamConfig(kind: JsKind): StreamConfig {
    const builder = JsStreamConfigBuilder.create(this.opts.serviceName).forKind(kind);

    const userConfig = this.opts.streamConfig?.[kind];

    if (userConfig) {
      builder.with(userConfig);
    }

    return builder.build();
  }

  /**
   * Ensures a stream exists with the given configuration.
   * Attempts to update the existing stream or create a new one if it doesn't exist.
   *
   * The operation follows this flow:
   * 1. Try to get existing stream info
   * 2. If exists, update with new subjects configuration
   * 3. If doesn't exist, create a new stream with full configuration.
   *
   * @param cfg Complete stream configuration.
   * @returns Observable that completes when stream is ready.
   */
  private ensureStream(cfg: StreamConfig): Observable<void> {
    return this.jsm$.pipe(
      switchMap((jsm) => this.tryUpdateOrCreateStream(jsm, cfg)),
      tap(() => this.logger.log(`Stream ready: ${cfg.name}`)),
      map(() => void 0),
    );
  }

  /**
   * Attempts to update existing stream or create new one if it doesn't exist.
   *
   * @param jsm JetStream manager instance.
   * @param cfg Stream configuration.
   * @returns Observable with stream operation result.
   */
  private tryUpdateOrCreateStream(
    jsm: JetStreamManager,
    cfg: StreamConfig,
  ): Observable<StreamInfo> {
    return defer(() => from(jsm.streams.info(cfg.name))).pipe(
      switchMap((info) => this.updateExistingStream(jsm, cfg, info)),
      catchError(() => this.createNewStream(jsm, cfg)),
    );
  }

  /**
   * Updates existing stream with new subjects configuration.
   *
   * @param jsm JetStream manager instance.
   * @param cfg Stream configuration.
   * @param info Current stream info.
   * @returns Observable with update result.
   */
  private updateExistingStream(
    jsm: JetStreamManager,
    cfg: StreamConfig,
    info: StreamInfo,
  ): Observable<StreamInfo> {
    this.logger.log(`Updating stream: ${cfg.name}`, {
      current: info.config.subjects,
      next: cfg.subjects,
    });

    return from(jsm.streams.update(cfg.name, { subjects: cfg.subjects }));
  }

  /**
   * Creates a new stream with full configuration.
   *
   * @param jsm JetStream manager instance.
   * @param cfg Stream configuration.
   * @returns Observable with creation result.
   */
  private createNewStream(jsm: JetStreamManager, cfg: StreamConfig): Observable<StreamInfo> {
    this.logger.log(`Creating stream: ${cfg.name}`);
    return from(jsm.streams.add(cfg));
  }
}
