export enum JetstreamTransportStrategy {
  Pull = 'pull',
  Push = 'push',
}

export enum JetstreamEvent {
  Connecting = 'connecting',
  Connected = 'connected',
  JetStreamAttached = 'jetstream-attached',
  Disconnected = 'disconnected',
  Error = 'error',
}

export enum JetstreamMessageType {
  Event = 'event',
  Command = 'cmd',
}