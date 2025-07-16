import { JetstreamMessageType } from './conts';

export const getJetstreamDurableName = (serviceName: string, type: JetstreamMessageType) =>
  `${serviceName}-${type}`;

export const getJetStreamFilterSubject = (serviceName: string, type: JetstreamMessageType) =>
  `${serviceName}.${type}.>`;

export const getStreamName = (serviceName: string) => `${serviceName.toLowerCase()}-stream`;

export const buildStreamSubjects = (
  serviceName: string,
  hasEvents: boolean,
  hasMessages: boolean,
): string[] => {
  const subjects: string[] = [];

  if (hasEvents) {
    subjects.push(getJetStreamFilterSubject(serviceName, JetstreamMessageType.Event));
  }

  if (hasMessages) {
    subjects.push(getJetStreamFilterSubject(serviceName, JetstreamMessageType.Command));
  }

  return subjects.length > 0 ? subjects : [`${serviceName}.>`];
};
