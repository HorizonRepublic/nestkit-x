import { JsKind } from './enum';

export const getJetstreamDurableName = (serviceName: string, type: JsKind) =>
  `${serviceName}-${type}`;

export const getJetStreamFilterSubject = (serviceName: string, type: JsKind) =>
  `${serviceName}.${type}.>`;
