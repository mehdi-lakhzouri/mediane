import { Logger } from '@nestjs/common';
import {
  type EmergencyMessage,
  NotificationChannel,
  NotificationKind,
  NotificationStatus,
} from '../domain/notification';
import { TextbeeSmsChannel } from './textbee-sms.channel';

const message: EmergencyMessage = {
  kind: NotificationKind.ALERT,
  incidentId: 'incident-1',
  driver: { firstName: 'Amira', lastName: 'Driver' },
  location: null,
  occurredAt: new Date('2026-10-03T10:00:30Z'),
};
const contact = { fullName: 'Sami', phoneNumber: '+21698000001', priority: 1 };
const config = {
  apiKey: 'test-key',
  deviceId: 'device-1',
  apiUrl: 'https://api.textbee.dev',
};

type FetchMock = jest.Mock<Promise<Response>, [URL, RequestInit]>;

function respond(status: number, body: unknown): FetchMock {
  return jest
    .fn<Promise<Response>, [URL, RequestInit]>()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

/** The JSON body of the first request. */
function sentBody(fetchFn: FetchMock): Record<string, unknown> {
  return JSON.parse(fetchFn.mock.calls[0][1].body as string) as Record<
    string,
    unknown
  >;
}

describe('TextbeeSmsChannel', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  it('sends one SMS to the contact with the API key and device', async () => {
    const fetchFn = respond(200, {
      data: { success: true, successCount: 1, failureCount: 0 },
    });
    const channel = new TextbeeSmsChannel(config, fetchFn);

    const result = await channel.deliver(message, contact);

    expect(result).toEqual({ status: NotificationStatus.SENT });
    expect(channel.channel).toBe(NotificationChannel.SMS);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url.href).toBe('https://api.textbee.dev/api/v1/gateway/send-sms');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'x-api-key': 'test-key' });
    const body = sentBody(fetchFn);
    expect(body).toMatchObject({
      recipients: ['+21698000001'],
      deviceId: 'device-1',
    });
    expect(body.message).toContain('Amira Driver');
  });

  it('omits the device when none is configured', async () => {
    const fetchFn = respond(200, { data: { success: true } });
    await new TextbeeSmsChannel({ ...config, deviceId: null }, fetchFn).deliver(
      message,
      contact,
    );
    expect(sentBody(fetchFn)).not.toHaveProperty('deviceId');
  });

  it('reports an HTTP error as a failed attempt', async () => {
    const result = await new TextbeeSmsChannel(
      config,
      respond(401, { message: 'Unauthorized' }),
    ).deliver(message, contact);
    expect(result).toEqual({
      status: NotificationStatus.FAILED,
      error: 'SMS_HTTP_401',
    });
  });

  it('reports a rejected recipient as a failed attempt', async () => {
    const result = await new TextbeeSmsChannel(
      config,
      respond(200, { data: { success: true, failureCount: 1 } }),
    ).deliver(message, contact);
    expect(result.error).toBe('SMS_REJECTED');
  });

  it('reports an unreachable provider, without logging the number', async () => {
    const fetchFn: FetchMock = jest
      .fn<Promise<Response>, [URL, RequestInit]>()
      .mockRejectedValue(new TypeError('fetch failed'));
    const result = await new TextbeeSmsChannel(config, fetchFn).deliver(
      message,
      contact,
    );
    expect(result.error).toBe('SMS_UNREACHABLE');
    const logged = (warn.mock.calls as [string][])
      .map(([line]) => line)
      .join('\n');
    expect(logged).toContain('incident-1');
    expect(logged).not.toContain('+21698000001');
    expect(logged).not.toContain('Sami');
  });
});
