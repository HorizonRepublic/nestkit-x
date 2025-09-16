import { Inject } from '@nestjs/common';

const TOKENS = new Map<string, symbol>();

export const createJetstreamToken = (serviceName: string): symbol => {
  const key = serviceName.toUpperCase();

  if (!TOKENS.has(key)) {
    TOKENS.set(key, Symbol(`JETSTREAM-CLIENT:${key}`));
  }

  return TOKENS.get(key) as symbol;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const InjectJetStreamProxy = (serviceName: string): PropertyDecorator & ParameterDecorator =>
  Inject(createJetstreamToken(serviceName));
