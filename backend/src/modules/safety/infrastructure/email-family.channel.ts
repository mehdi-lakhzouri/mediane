import { Injectable } from '@nestjs/common';
import { MailSender } from '../../mail/application/mail-sender';
import {
  type DeliveryResult,
  type EmergencyMessage,
  FamilyAlertChannel,
  NotificationChannel,
  NotificationKind,
  NotificationStatus,
} from '../domain/notification';

/** Family members have accounts, so they are reached by email. */
@Injectable()
export class EmailFamilyChannel extends FamilyAlertChannel {
  readonly channel = NotificationChannel.EMAIL;

  constructor(private readonly mail: MailSender) {
    super();
  }

  async deliver(
    message: EmergencyMessage,
    member: { firstName: string; email: string },
  ): Promise<DeliveryResult> {
    const mail = {
      to: member.email,
      firstName: member.firstName,
      driverName: `${message.driver.firstName} ${message.driver.lastName}`,
      occurredAt: message.occurredAt,
    };
    await (message.kind === NotificationKind.ALERT
      ? this.mail.sendFamilyIncidentAlert(mail)
      : this.mail.sendFamilyAllClear(mail));
    return { status: NotificationStatus.SENT };
  }
}
