// managers/js.pull-runner.ts
import { Consumer, JsMsg } from 'nats';
import { catchError, defer, from, map, mergeMap, Observable, repeat, switchMap, timer } from 'rxjs';
import { RuntimeException } from '@nestjs/core/errors/exceptions';
import { Logger } from '@nestjs/common';

/**
 * NATS JetStream pull consumer runner with automatic retry and error handling.
 */
export class JsPullRunner {
  private readonly logger = new Logger(JsPullRunner.name);

  private constructor(
    private readonly consumer: Consumer,
    private readonly handle: (m: JsMsg) => Observable<void>,
    private readonly expiresMs = 30_000,
  ) {}

  /**
   * Factory method to create a new JsPullRunner instance.
   *
   * @param consumer NATS JetStream consumer.
   * @param opts Configuration options.
   * @param opts.expiresMs Timeout for pull operations in milliseconds.
   * @param opts.handle Message handler function that processes JetStream messages.
   * @throws RuntimeException if expiresMs is less than 1000ms.
   *
   * @returns New JsPullRunner instance.
   */
  public static create(
    consumer: Consumer,
    opts: {
      expiresMs?: number;
      handle(m: JsMsg): Observable<void>;
    },
  ): JsPullRunner {
    if (opts.expiresMs && opts.expiresMs < 1000) {
      throw new RuntimeException('expiresMs must be at least 1000ms');
    }

    return new JsPullRunner(consumer, opts.handle, opts.expiresMs ?? 30_000);
  }

  /**
   * Starts the pull consumer loop with automatic retry on errors.
   *
   * @returns Observable that never completes, continuously pulling messages.
   */
  public run(): Observable<void> {
    this.logger.debug('Starting pull consumer run...');

    return defer(() => {
      this.logger.debug('Getting consumer info...');

      return from(this.consumer.info());
    }).pipe(
      switchMap((info) => {
        this.logger.debug({
          msg: 'Consumer info',
          name: info.name,
          numPending: info.num_pending,
          delivered: info.delivered,
        });

        return this.createPullLoop();
      }),

      catchError((error) => {
        this.logger.error({ msg: 'Error in pull consumer run', error });

        return this.handleError();
      }),
      map(() => void 0),
    );
  }

  /**
   * Creates a continuous message consumption stream using consume() with pure RxJS.
   *
   * @returns Observable that never completes, continuously processing messages.
   */
  private createPullLoop(): Observable<void> {
    return defer(() =>
      from(
        this.consumer.consume({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_messages: 200,
          expires: this.expiresMs,
        }),
      ),
    ).pipe(
      // Convert async iterable to observable stream
      switchMap((consumerMessages) => from(consumerMessages as AsyncIterable<JsMsg>)),

      // Process each message - let handler manage ACK/NACK
      mergeMap(
        (message: JsMsg) => this.handle(message),
        25, // Process up to 25 messages concurrently
      ),

      // Restart consumer when the stream completes
      repeat({
        delay: () => timer(1000),
      }),

      // Handle infrastructure errors with restart
      catchError((error) => {
        this.logger.error({ msg: 'Consumer infrastructure error', error });
        return timer(2000).pipe(switchMap(() => this.createPullLoop()));
      }),
    );
  }

  /**
   * Handles errors with a delay before retry.
   *
   * @returns Observable that retries the pull consumer loop after delay.
   */
  private handleError(): Observable<void> {
    return timer(500).pipe(switchMap(() => this.run()));
  }
}
