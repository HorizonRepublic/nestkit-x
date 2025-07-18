// managers/js.pull-runner.ts
import { Consumer, JsMsg } from 'nats';
import { catchError, defer, from, map, Observable, of, repeat, switchMap, timer } from 'rxjs';

/**
 * NATS JetStream pull consumer runner with automatic retry and error handling.
 */
export class JsPullRunner {
  private constructor(
    private readonly consumer: Consumer,
    private readonly handle: (m: JsMsg) => Observable<void>,
    private readonly expiresMs = 30_000,
  ) {}

  /**
   * Factory method to create a new JsPullRunner instance.
   *
   * @param consumer - NATS JetStream consumer
   * @param opts - Configuration options
   * @returns New JsPullRunner instance
   */
  public static create(
    consumer: Consumer,
    opts: {
      expiresMs?: number;
      handle: (m: JsMsg) => Observable<void>;
    },
  ) {
    return new JsPullRunner(consumer, opts.handle, opts.expiresMs ?? 30_000);
  }

  /**
   * Starts the pull consumer loop with automatic retry on errors.
   *
   * @returns Observable that never completes, continuously pulling messages
   */
  public run(): Observable<void> {
    return defer(() => from(this.consumer.info())).pipe(
      switchMap(() => this.createPullLoop()),
      catchError(() => this.handleError()),
      map(() => void 0),
    );
  }

  /**
   * Creates the main message-pulling loop.
   */
  private createPullLoop(): Observable<void> {
    return defer(() => from(this.consumer.next({ expires: this.expiresMs }))).pipe(
      switchMap((message) => this.processMessage(message)),
      repeat(),
    );
  }

  /**
   * Processes a single message or handles empty pulls.
   */
  private processMessage(message: JsMsg | null): Observable<void> {
    return message ? this.handle(message) : of(void 0);
  }

  /**
   * Handles errors with a 0.5-second delay before retry.
   */
  private handleError(): Observable<void> {
    return timer(500).pipe(switchMap(() => this.run()));
  }
}
