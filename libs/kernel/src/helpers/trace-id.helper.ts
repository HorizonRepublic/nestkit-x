import { IncomingMessage } from 'node:http';
import { HeaderKeys } from '../enum/header-keys.enum';
import { v7 } from 'uuid';

export const genReqId = (req: IncomingMessage): string => {
  const headers = req.headers;
  const id = headers[HeaderKeys.TraceId] ?? headers[HeaderKeys.CorrelationId];

  return (Array.isArray(id) ? id[0] : id) ?? v7();
};
