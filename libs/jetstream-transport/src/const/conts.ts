export enum JetstreamEvent {
  Connecting = 'connecting',
  Connected = 'connected',
  JetStreamAttached = 'jetstream-attached',
  Disconnected = 'disconnected',
  Error = 'error',
}

export enum JetStreamErrorCodes {
  NotFound = 10148,
}

export enum JetstreamHeaders {
  ReplyTo = 'reply-to',
  User = 'user',
  CallerName = 'service-name',
  RequestId = 'request-id',
  TraceId = 'trace-id',
  SpanId = 'span-id',
}
