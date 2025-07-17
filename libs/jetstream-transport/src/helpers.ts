import { JetstreamMessageType } from './conts';

export const getJetstreamDurableName = (serviceName: string, type: JetstreamMessageType) =>
  `${serviceName}-${type}`;

export const getJetStreamFilterSubject = (serviceName: string, type: JetstreamMessageType) =>
  `${serviceName}.${type}.>`;

export const getStreamName = (serviceName: string) => `${serviceName.toLowerCase()}-stream`;
