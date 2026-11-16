import { Logger } from '@nestjs/common';
import type { TextbeeConfig } from '../../../config';
import { composeEmergencySms } from '../domain/emergency-sms';
import {
  type DeliveryResult,
  EmergencyContactChannel,
  type EmergencyMessage,
  NotificationChannel,
  NotificationStatus,
} from '../domain/notification';

/** A stuck provider must not hold up the next contacts in the call order. */
const REQUEST_TIMEOUT_MS = 10_000;

/** The slice of `fetch` this channel uses (swapped in tests). */
export type SmsFetch = (url: URL, init: RequestInit) => Promise<Response>;

interface TextbeeSendResult {
  data?: { success?: boolean; failureCount?: number };
}

/**
 * Emergency contacts by SMS through textbee.dev (an Android phone running the
 * textbee app sends the messages). One request per contact so each attempt
 * is recorded on its own. Logs carry the incident id, the call order and a
 * reason code only: never a name, number, location or the message itself.
 */
export class TextbeeSmsChannel extends EmergencyContactChannel {
  readonly channel = NotificationChannel.SMS;
  private readonly logger = new Logger('EmergencyContacts');

  constructor(
    private readonly config: TextbeeConfig,
    private readonly fetchFn: SmsFetch = (url, init) => fetch(url, init),
  ) {
    super();
  }

  async deliver(
    message: EmergencyMessage,
    contact: { phoneNumber: string; priority: number },
  ): Promise<DeliveryResult> {
    const result = await this.send(message, contact.phoneNumber);
    if (result.status !== NotificationStatus.SENT) {
      this.logger.warn(
        `${message.kind} SMS for incident ${message.incidentId}: contact #${contact.priority} not sent (${result.error})`,
      );
    }
    return result;
  }

  private async send(
    message: EmergencyMessage,
    phoneNumber: string,
  ): Promise<DeliveryResult> {
    let response: Response;
    try {
      response = await this.fetchFn(
        new URL('/api/v1/gateway/send-sms', this.config.apiUrl),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
          },
          body: JSON.stringify({
            recipients: [phoneNumber],
            message: composeEmergencySms(message),
            ...(this.config.deviceId ? { deviceId: this.config.deviceId } : {}),
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      return failed(timedOut ? 'SMS_TIMEOUT' : 'SMS_UNREACHABLE');
    }

    if (!response.ok) return failed(`SMS_HTTP_${response.status}`);
    const body = (await response
      .json()
      .catch(() => null)) as TextbeeSendResult | null;
    if (body?.data?.success === false || (body?.data?.failureCount ?? 0) > 0) {
      return failed('SMS_REJECTED');
    }
    return { status: NotificationStatus.SENT };
  }
}

function failed(error: string): DeliveryResult {
  return { status: NotificationStatus.FAILED, error };
}
