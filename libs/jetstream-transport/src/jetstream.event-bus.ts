import { Logger } from '@nestjs/common';
import { JetstreamEvent } from './conts';
import { NatsConnection } from 'nats';
import { BehaviorSubject, filter, map, Observable, Subject, Subscription } from 'rxjs';
import { share } from 'rxjs/operators';

/**
 * Type mapping for event arguments based on JetStream event types.
 * Maps each event to its specific argument tuple.
 */
type EventArgsMap = {
  [JetstreamEvent.Connected]: [NatsConnection];
  [JetstreamEvent.Error]: [unknown];
  [JetstreamEvent.Connecting]: [];
  [JetstreamEvent.Disconnected]: [];
  [JetstreamEvent.JetStreamAttached]: [];
};

/**
 * Get an argument type for a specific event
 */
type ArgsOf<E extends JetstreamEvent> = EventArgsMap[E];

/**
 * Internal event payload structure for efficient type-safe emission.
 */
interface EventPayload<E extends JetstreamEvent = JetstreamEvent> {
  event: E;
  args: ArgsOf<E>;
}

/**
 * RxJS-based event bus for JetStream events.
 *
 * Performance optimizations:
 * - Single Subject for all events with efficient filtering
 * - Shared observables to prevent duplicate subscriptions
 * - Minimal memory allocation during emission
 * - Fast Map-based event stream caching
 * - Built-in error isolation per event type
 * - Status tracking based on events
 */
export class JetstreamEventBus {
  private readonly logger = new Logger(JetstreamEventBus.name);

  /**
   * Central event subject - all events flow through here for maximum efficiency
   */
  private readonly eventSubject = new Subject<EventPayload>();

  /**
   * Cached observables per event type to prevent duplicate filtering
   */
  private readonly eventStreams = new Map<JetstreamEvent, Observable<any>>();

  /**
   * Status subject that tracks connection status based on events
   */
  private readonly statusSubject = new BehaviorSubject<JetstreamEvent>(JetstreamEvent.Connecting);

  /**
   * Track if the event bus is destroyed to prevent memory leaks
   */
  private isDestroyed = false;

  public constructor() {
    this.setupStatusTracking();
  }

  /**
   * Sets up automatic status tracking based on emitted events
   */
  private setupStatusTracking(): void {
    this.eventSubject.subscribe((payload) => {
      // Мапимо події в статуси - просто використовуємо самі події як статуси
      switch (payload.event) {
        case JetstreamEvent.Connecting:
        case JetstreamEvent.Connected:
        case JetstreamEvent.JetStreamAttached:
        case JetstreamEvent.Error:
        case JetstreamEvent.Disconnected:
          this.statusSubject.next(payload.event);
          break;
      }
    });
  }

  /**
   * Returns an observable that emits status changes based on events
   */
  public get status(): Observable<JetstreamEvent> {
    return this.statusSubject.asObservable();
  }

  /**
   * Emits an event to all registered listeners.
   *
   * @param event - The JetStream event type to emit
   * @param args - Arguments to pass to event listeners
   * @template E - The specific JetStream event type
   */
  public emit<E extends JetstreamEvent>(event: E, ...args: ArgsOf<E>): void {
    if (this.isDestroyed) return;

    this.eventSubject.next({ event, args } as EventPayload<E>);
  }

  /**
   * Creates an observable for the specified event type.
   * Uses caching to ensure a single observable per-event type for optimal performance.
   *
   * @param event - The JetStream event type to listen for
   * @param callback
   * @returns Observable that emits event arguments
   * @template E - The specific JetStream event type
   */
  public on<E extends JetstreamEvent>(
    event: E,
    callback: (...args: ArgsOf<E>) => any,
  ): Subscription {
    let stream = this.eventStreams.get(event);
    if (!stream) {
      stream = this.eventSubject.pipe(
        filter((p) => p.event === event),
        map((p) => p.args as ArgsOf<E>),
        share({ resetOnComplete: false }),
      );
      this.eventStreams.set(event, stream);
    }
    return stream.subscribe({
      next: (args) => {
        try {
          callback(...args);
        } catch (e) {
          this.logger.error(`Event‑bus error ${event}`, e);
        }
      },
      error: (err) => this.logger.error(`Stream error ${event}`, err),
    });
  }

  /**
   * Destroys the event bus and cleans up all resources.
   * Should be called during cleanup to prevent memory leaks.
   */
  public destroy(): void {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.eventStreams.clear();
    this.eventSubject.complete();
    this.statusSubject.complete();
  }

  /**
   * Checks if the event bus is destroyed.
   */
  public get destroyed(): boolean {
    return this.isDestroyed;
  }
}
