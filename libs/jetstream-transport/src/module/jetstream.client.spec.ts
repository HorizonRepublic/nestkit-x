import { InternalServerErrorException } from '@nestjs/common';
import { JetstreamEvent } from '../const/enum';
import { JetstreamClient } from './jetstream.client';

type TestReadPacket = { pattern: string; data: unknown };
type TestWritePacket = { err: unknown; response: unknown };
type MockNatsConnection = { publish: jest.Mock; subscribe: jest.Mock };

jest.mock('../managers/js.connection-manager', () => {
  const { ReplaySubject, of } = jest.requireActual<typeof import('rxjs')>('rxjs');

  return {
    JsConnectionManager: jest.fn().mockImplementation(() => {
      const connection$ = new ReplaySubject<MockNatsConnection>(1);

      return {
        connection$,
        getNatsConnection: jest.fn(() => connection$.asObservable()),
        close: jest.fn(() => of(void 0)),
        getRef: jest.fn(() => null),
      };
    }),
  };
});

describe('JetstreamClient', () => {
  const options = {
    serviceName: 'test-service',
    connectionOptions: {} as any,
  };

  const createPacket = (pattern: string): TestReadPacket => ({
    pattern,
    data: { foo: 'bar' },
  });

  const getInternals = (client: JetstreamClient) => ({
    eventBus: (client as any).eventBus,
    connectionManager: (client as any).connectionManager as {
      connection$: { next(value: MockNatsConnection): void };
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects event dispatch when transport is unavailable', async () => {
    const client = new JetstreamClient(options);
    const { eventBus } = getInternals(client);

    eventBus.emit(JetstreamEvent.Disconnected);

    await expect(client['dispatchEvent'](createPacket('test.event'))).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('invokes callback with error when command transport is unavailable', async () => {
    const client = new JetstreamClient(options);
    const { eventBus } = getInternals(client);

    eventBus.emit(JetstreamEvent.Error);

    const callback = jest.fn();
    client['publish'](createPacket('test.command'), callback);

    await new Promise<void>((resolve) => process.nextTick(resolve));

    expect(callback).toHaveBeenCalledTimes(1);
    const [packet] = callback.mock.calls[0] as [TestWritePacket];
    expect(packet.err).toBeInstanceOf(InternalServerErrorException);
    expect(packet.response).toBeNull();
  });

  it('publishes messages when transport becomes ready', async () => {
    const client = new JetstreamClient(options);
    const { eventBus, connectionManager } = getInternals(client);

    const connection: MockNatsConnection = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    eventBus.emit(JetstreamEvent.Connected);
    connectionManager.connection$.next(connection);

    await expect(client['dispatchEvent'](createPacket('ready.event'))).resolves.toBeUndefined();
    expect(connection.publish).toHaveBeenCalled();

    const callback = jest.fn();
    client['publish'](createPacket('ready.command'), callback);
    await new Promise<void>((resolve) => process.nextTick(resolve));
    expect(connection.publish).toHaveBeenCalledTimes(2);
    expect(callback).not.toHaveBeenCalled();
  });
});
