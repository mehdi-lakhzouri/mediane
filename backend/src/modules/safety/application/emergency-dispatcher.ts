import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { type IncidentRecord, IncidentTimelineKind } from '../domain/incident';
import {
  type DeliveryResult,
  EmergencyContactChannel,
  type EmergencyMessage,
  FamilyAlertChannel,
  type IncidentRecipients,
  type NotificationAttempt,
  NotificationKind,
  NotificationRecipientType,
  NotificationStatus,
  SafetyDirectory,
} from '../domain/notification';
import {
  type DispatchClaim,
  IncidentRepository,
} from '../domain/safety.repository';

/**
 * Reaches everyone for one leased incident: emergency contacts in priority
 * order, then family members who were given incident sharing. An all-clear
 * goes only to people the alert actually reached. Each attempt is recorded
 * for the driver; nothing personal or medical is logged.
 */
@Injectable()
export class EmergencyDispatcher {
  private readonly logger = new Logger(EmergencyDispatcher.name);

  constructor(
    private readonly incidents: IncidentRepository,
    private readonly directory: SafetyDirectory,
    private readonly contactChannel: EmergencyContactChannel,
    private readonly familyChannel: FamilyAlertChannel,
    private readonly inbox: NotificationsService,
  ) {}

  async deliver(claim: DispatchClaim, now: Date = new Date()): Promise<void> {
    const { incident, kind } = claim;
    const everyone = await this.directory.recipientsFor(incident.userId);
    const recipients =
      kind === NotificationKind.ALL_CLEAR
        ? await this.alertedAmong(incident.id, everyone)
        : everyone;

    const message: EmergencyMessage = {
      kind,
      incidentId: incident.id,
      driver: everyone.driver,
      location: kind === NotificationKind.ALERT ? incident.location : null,
      occurredAt:
        (kind === NotificationKind.ALERT
          ? incident.escalatedAt
          : incident.resolvedAt) ?? now,
    };

    const attempts: NotificationAttempt[] = [];
    for (const contact of recipients.contacts) {
      const result = await this.attempt(() =>
        this.contactChannel.deliver(message, contact),
      );
      attempts.push({
        kind,
        recipientType: NotificationRecipientType.EMERGENCY_CONTACT,
        recipientUserId: null,
        recipientName: contact.fullName,
        priority: contact.priority,
        channel: this.contactChannel.channel,
        status: result.status,
        error: result.error ?? null,
        attemptedAt: new Date(),
      });
    }
    for (const member of recipients.family) {
      const result = await this.attempt(() =>
        this.familyChannel.deliver(message, member),
      );
      attempts.push({
        kind,
        recipientType: NotificationRecipientType.FAMILY_MEMBER,
        recipientUserId: member.userId,
        recipientName: `${member.firstName} ${member.lastName}`,
        priority: null,
        channel: this.familyChannel.channel,
        status: result.status,
        error: result.error ?? null,
        attemptedAt: new Date(),
      });
    }

    const failed = attempts.filter(
      (attempt) => attempt.status === NotificationStatus.FAILED,
    ).length;
    await this.incidents.addNotifications(incident.id, attempts);
    await this.incidents.addTimeline(
      incident.id,
      IncidentTimelineKind.NOTIFIED,
      now,
      {
        kind,
        contacts: recipients.contacts.length,
        family: recipients.family.length,
        failed,
      },
    );
    await this.notifyInApp(kind, incident, everyone);
    await this.incidents.completeDispatch(incident.id, kind, now);
    if (failed > 0) {
      this.logger.warn(
        `Incident ${incident.id}: ${failed} of ${attempts.length} ${kind} deliveries failed`,
      );
    }
  }

  /**
   * The notification centers: every sharing family member (who cannot mute
   * an emergency), and the driver, who may not have had the app open.
   */
  private async notifyInApp(
    kind: DispatchClaim['kind'],
    incident: IncidentRecord,
    everyone: IncidentRecipients,
  ): Promise<void> {
    const memberName = everyone.driver.firstName;
    const family = everyone.family.map((member) => member.userId);
    if (kind === NotificationKind.ALERT) {
      await this.inbox.notify(family, {
        type: 'FAMILY_MEMBER_NEEDS_HELP',
        memberName,
      });
      await this.inbox.notify(incident.userId, {
        type: 'OWN_ALERT_ESCALATED',
        incidentId: incident.id,
      });
    } else {
      await this.inbox.notify(family, {
        type: 'FAMILY_MEMBER_SAFE',
        memberName,
      });
    }
  }

  /** Contacts and members the alert reached, still on the driver's lists. */
  private async alertedAmong(
    incidentId: string,
    everyone: IncidentRecipients,
  ): Promise<IncidentRecipients> {
    const reached = (await this.incidents.listNotifications(incidentId)).filter(
      (n) =>
        n.kind === NotificationKind.ALERT &&
        n.status === NotificationStatus.SENT,
    );
    const contactKeys = new Set(
      reached
        .filter(
          (n) =>
            n.recipientType === NotificationRecipientType.EMERGENCY_CONTACT,
        )
        .map((n) => `${n.priority}:${n.recipientName}`),
    );
    const memberIds = new Set(
      reached.flatMap((n) => (n.recipientUserId ? [n.recipientUserId] : [])),
    );
    return {
      driver: everyone.driver,
      contacts: everyone.contacts.filter((c) =>
        contactKeys.has(`${c.priority}:${c.fullName}`),
      ),
      family: everyone.family.filter((m) => memberIds.has(m.userId)),
    };
  }

  private async attempt(
    send: () => Promise<DeliveryResult>,
  ): Promise<DeliveryResult> {
    try {
      return await send();
    } catch {
      return { status: NotificationStatus.FAILED, error: 'DELIVERY_ERROR' };
    }
  }
}
