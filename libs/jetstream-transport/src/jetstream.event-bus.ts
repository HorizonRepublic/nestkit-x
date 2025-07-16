import { Logger } from '@nestjs/common';
import { JetstreamEvent } from './conts';
import { NatsConnection } from 'nats';
import { EMPTY, Observable, Subject } from 'rxjs';
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
   * Track if the event bus is destroyed to prevent memory leaks
   */
  private isDestroyed = false;

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
   * Uses caching to ensure single observable per event type for optimal performance.
   *
   * @param event - The JetStream event type to listen for
   * @returns Observable that emits event arguments
   * @template E - The specific JetStream event type
   */
  public on<E extends JetstreamEvent>(event: E): Observable<ArgsOf<E>> {
    if (this.isDestroyed) return EMPTY;

    // Return cached observable if exists
    let stream = this.eventStreams.get(event);
    if (stream) {
      return stream;
    }

    // Create optimized stream
    stream = new Observable<ArgsOf<E>>((subscriber) => {
      const subscription = this.eventSubject.subscribe({
        next: (payload) => {
          if (payload.event === event) {
            try {
              subscriber.next(payload.args as ArgsOf<E>);
            } catch (error) {
              this.logger.error(`Event bus emission error for '${event}':`, error);
            }
          }
        },

        error: (error) => {
          this.logger.error(`Event bus stream error for '${event}':`, error);
          subscriber.error(error);
        },

        complete: () => subscriber.complete(),
      });

      return () => subscription.unsubscribe();
    }).pipe(share());

    this.eventStreams.set(event, stream);
    return stream;
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
  }

  /**
   * Checks if the event bus is destroyed.
   */
  public get destroyed(): boolean {
    return this.isDestroyed;
  }
}
