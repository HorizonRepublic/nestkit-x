import { Observable, of } from 'rxjs';
import { JetstreamStrategy } from './jetstream.strategy';

export class JetstreamPullStrategy extends JetstreamStrategy {
  protected override setupStream(): Observable<void> {
    return of();
  }

  protected override setupEventHandlers(): Observable<void> {
    return of();
  }

  protected override setupMessageHandlers(): Observable<void> {
    return of();
  }
}
