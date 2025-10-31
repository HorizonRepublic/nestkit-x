export const getJetStreamTransportToken = (name: string): string => `jetstream-transport-${name}`;

export const getJetStreamClientToken = (name: string): string => `jetstream-client-proxy-${name}`;

export const getJetStreamOptionsToken = (name: string): string => `jetstream-options-${name}`;

export const getToken = {
  connection: (name: string): string => `jetstream-connection-${name}`,
  strategy: (name: string): string => `jetstream-strategy-${name}`,
  stream: (name: string): string => `jetstream-stream-${name}`,
  consumer: (name: string): string => `jetstream-consumer-${name}`,
  patternRegistry: (name: string): string => `jetstream-pattern-registry-${name}`,
  message: (name: string): string => `jetstream-message-${name}`,
  messageRouting: (name: string): string => `jetstream-message-routing-${name}`,
} as const;
