import {
  AckPolicy,
  Consumer,
  DeliverPolicy,
  DiscardPolicy,
  JsMsg,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
  StoreCompression,
  StreamConfig,
} from 'nats';
import { catchError, defer, finalize, from, Observable, of, repeat, switchMap, timer } from 'rxjs';
import { JetstreamStrategy } from './jetstream.strategy';
import { getJetstreamDurableName, getJetStreamFilterSubject, getStreamName } from '../helpers';
import {
  JetstreamConsumerSetup,
  JetstreamHeaders,
  JetstreamMessageType,
} from '@nestkit-x/jetstream-transport';

export class JetstreamPullStrategy extends JetstreamStrategy {
  /* ---------- таймаути і ліміти ---------- */


  /* ================================================================
   *  STREAMS
   * ================================================================ */

  /* ---------- STREAM CONFIGS (повністю) ---------- */

}
