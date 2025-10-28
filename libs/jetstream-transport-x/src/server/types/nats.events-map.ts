import { DebugEvents, Events, ServersChanged } from 'nats';

/**
 * Type-safe event map for NATS connection status events.
 * Maps each event type to its callback signature based on Status.data field.
 */
export interface INatsEventsMap extends Record<string, (...args: any[]) => void> {
  // Connection lifecycle events
  [Events.Disconnect]: () => void;
  [Events.Reconnect]: () => void;
  [Events.Update]: (data: ServersChanged) => void;
  [Events.LDM]: () => void;

  // Error events
  [Events.Error]: (data: unknown) => void;

  // Debug events
  [DebugEvents.Reconnecting]: () => void;
  [DebugEvents.PingTimer]: () => void;
  [DebugEvents.StaleConnection]: () => void;
}
