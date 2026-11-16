import { Injectable, Logger } from '@nestjs/common';
import {
  type DeliveryResult,
  EmergencyContactChannel,
  type EmergencyMessage,
  NotificationChannel,
  NotificationStatus,
} from '../domain/notification';

/**
 * Used when no SMS provider is configured (TEXTBEE_API_KEY empty): records
 * that the contact would have been reached. The line carries the incident id and the
 * call order only, never a name, number, location or medical detail.
 */
@Injectable()
export class LoggingContactChannel extends EmergencyContactChannel {
  readonly channel = NotificationChannel.LOG;
  private readonly logger = new Logger('EmergencyContacts');

  deliver(
    message: EmergencyMessage,
    contact: { priority: number },
  ): Promise<DeliveryResult> {
    this.logger.warn(
      `${message.kind} for incident ${message.incidentId}: contact #${contact.priority} (no SMS provider configured)`,
    );
    return Promise.resolve({ status: NotificationStatus.SENT });
  }
}
