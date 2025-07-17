// managers/js.pull-runner.ts
import { Consumer, JsMsg } from 'nats';
import { catchError, defer, from, map, Observable, of, repeat, switchMap, timer } from 'rxjs';
import { LoggerService } from '@nestjs/common';

export class JsPullRunner {
  private constructor(
    private readonly consumer: Consumer,
    private readonly handle: (m: JsMsg) => Observable<void>,
    private readonly logger: LoggerService,
    private readonly expiresMs = 30_000,
  ) {}

  /* ── factory ───────────────────────────────────── */
  static create(
    consumer: Consumer,
    opts: {
      logger: LoggerService;
      expiresMs?: number;
      handle: (m: JsMsg) => Observable<void>;
    },
  ) {
    return new JsPullRunner(consumer, opts.handle, opts.logger, opts.expiresMs ?? 30_000);
  }

  /* ── run loop ──────────────────────────────────── */
  run(): Observable<void> {
    return defer(() => from(this.consumer.info())).pipe(
      switchMap(() =>
        defer(() => from(this.consumer.next({ expires: this.expiresMs }))).pipe(
          switchMap((m) => (m ? this.handle(m) : of(void 0))),
          repeat(),
        ),
      ),
      catchError(() => {
        return timer(1000).pipe(switchMap(() => this.run()));
      }),
      map(() => void 0),
    );
  }
}
