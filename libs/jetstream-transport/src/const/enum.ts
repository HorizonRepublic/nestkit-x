export enum JsKind {
  Command = 'cmd',
  Event = 'ev',
}

export enum JetstreamEvent {
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnected = 'reconnected',
  JetStreamAttached = 'jetstream-attached',
  Disconnected = 'disconnected',
  Error = 'error',
}

export enum JetStreamErrorCodes {
  ConsumerNotFound = 10014,
  ConsumerExists = 10013,
  StreamNotFound = 10059,
}

export enum JetstreamHeaders {
  CorrelationId = 'correlation-id',
  ReplyTo = 'reply-to',
  MessageId = 'message-id',
  Subject = 'subject',
  User = 'user',
  CallerName = 'service-name',
  RequestId = 'request-id',
  TraceId = 'trace-id',
  SpanId = 'span-id',
}
