import { Observable } from 'rxjs';
import { JetstreamStrategy } from './jetstream.strategy';

export class JetstreamPushStrategy extends JetstreamStrategy {
  protected override setupCommandStream(): Observable<void> {
    throw new Error('Method not implemented.');
  }

  protected override setupEventStream(): Observable<void> {
    throw new Error('Method not implemented.');
  }

  protected override setupEventHandlers(): Observable<void> {
    throw new Error('Method not implemented.');
  }

  protected override setupMessageHandlers(): Observable<void> {
    throw new Error('Method not implemented.');
  }
}
