import {
  type IncidentRecord,
  IncidentStatus,
  IncidentTimelineKind,
  type TimelineEntry,
} from '../domain/incident';
import {
  type DeliveryResult,
  EmergencyContactChannel,
  type EmergencyMessage,
  FamilyAlertChannel,
  type IncidentRecipients,
  type NotificationAttempt,
  NotificationChannel,
  type NotificationRecord,
  NotificationStatus,
  SafetyDirectory,
} from '../domain/notification';
import { MedicalEventSeverity, MedicalEventType } from '../domain/safety';
import type { IncidentRepository } from '../domain/safety.repository';
import type { NotificationsService } from '../../notifications/application/notifications.service';
import { EmergencyDispatcher } from './emergency-dispatcher';

const incident: IncidentRecord = {
  id: 'incident-1',
  userId: 'driver-1',
  status: IncidentStatus.ESCALATED,
  severity: MedicalEventSeverity.CRITICAL,
  triggerType: MedicalEventType.STROKE,
  openedAt: new Date('2026-10-03T10:00:00Z'),
  respondBy: null,
  acknowledgedAt: null,
  acknowledgedVia: null,
  escalatedAt: new Date('2026-10-03T10:00:30Z'),
  resolvedAt: null,
  resolvedVia: null,
  location: { latitude: 36.8, longitude: 10.18, accuracyM: 10 },
};

const recipients: IncidentRecipients = {
  driver: {
    firstName: 'Amira',
    lastName: 'Driver',
    phoneNumber: '+21655000001',
  },
  contacts: [
    { fullName: 'Sami', phoneNumber: '+21698000001', priority: 1 },
    { fullName: 'Lina', phoneNumber: '+21698000002', priority: 2 },
  ],
  family: [
    { userId: 'm-1', firstName: 'Bilel', lastName: 'D', email: 'b@x.test' },
    { userId: 'm-2', firstName: 'Emna', lastName: 'D', email: 'e@x.test' },
  ],
};

class RecordingContacts extends EmergencyContactChannel {
  readonly channel = NotificationChannel.LOG;
  readonly sent: { message: EmergencyMessage; priority: number }[] = [];
  failPriority: number | null = null;

  deliver(
    message: EmergencyMessage,
    contact: { priority: number },
  ): Promise<DeliveryResult> {
    if (contact.priority === this.failPriority) {
      return Promise.reject(new Error('provider down'));
    }
    this.sent.push({ message, priority: contact.priority });
    return Promise.resolve({ status: NotificationStatus.SENT });
  }
}

class RecordingFamily extends FamilyAlertChannel {
  readonly channel = NotificationChannel.EMAIL;
  readonly sent: { message: EmergencyMessage; email: string }[] = [];

  deliver(
    message: EmergencyMessage,
    member: { email: string },
  ): Promise<DeliveryResult> {
    this.sent.push({ message, email: member.email });
    return Promise.resolve({ status: NotificationStatus.SENT });
  }
}

describe('EmergencyDispatcher', () => {
  let stored: NotificationRecord[];
  let completed: string[];
  let contacts: RecordingContacts;
  let family: RecordingFamily;
  let dispatcher: EmergencyDispatcher;
  let inbox: { notify: jest.Mock };
  let timeline: TimelineEntry[];
  let timelineUnavailable: boolean;

  beforeEach(() => {
    stored = [];
    timelineUnavailable = false;
    timeline = [
      {
        kind: IncidentTimelineKind.ESCALATED,
        at: incident.escalatedAt!,
        detail: { reason: 'NO_RESPONSE' },
      },
    ];
    completed = [];
    contacts = new RecordingContacts();
    family = new RecordingFamily();
    const incidents = {
      listNotifications: () => Promise.resolve(stored),
      listTimeline: () =>
        timelineUnavailable
          ? Promise.reject(new Error('timeline unavailable'))
          : Promise.resolve(timeline),
      addNotifications: (_id: string, attempts: NotificationAttempt[]) => {
        stored.push(
          ...attempts.map((a, i) => ({ ...a, id: `n-${stored.length + i}` })),
        );
        return Promise.resolve();
      },
      addTimeline: () => Promise.resolve(),
      completeDispatch: (_id: string, kind: string) => {
        completed.push(kind);
        return Promise.resolve();
      },
    } as unknown as IncidentRepository;
    const directory = {
      recipientsFor: () => Promise.resolve(recipients),
    } as unknown as SafetyDirectory;
    inbox = { notify: jest.fn().mockResolvedValue(1) };
    dispatcher = new EmergencyDispatcher(
      incidents,
      directory,
      contacts,
      family,
      inbox as unknown as NotificationsService,
    );
  });

  it('alerts contacts in priority order, then family, with location', async () => {
    await dispatcher.deliver({ incident, kind: 'ALERT' });

    expect(contacts.sent.map((s) => s.priority)).toEqual([1, 2]);
    expect(family.sent.map((s) => s.email)).toEqual(['b@x.test', 'e@x.test']);
    expect(contacts.sent[0].message.location).toEqual(incident.location);
    expect(contacts.sent[0].message.alertReason).toBe('NO_RESPONSE');
    expect(contacts.sent[0].message.driver.phoneNumber).toBe('+21655000001');
    expect(stored).toHaveLength(4);
    expect(completed).toEqual(['ALERT']);
    expect(inbox.notify).toHaveBeenCalledWith(['m-1', 'm-2'], {
      type: 'FAMILY_MEMBER_NEEDS_HELP',
      memberName: 'Amira',
    });
    expect(inbox.notify).toHaveBeenCalledWith('driver-1', {
      type: 'OWN_ALERT_ESCALATED',
      incidentId: 'incident-1',
    });
  });

  it('records a failed delivery and still reaches everyone else', async () => {
    contacts.failPriority = 1;
    await dispatcher.deliver({ incident, kind: 'ALERT' });

    expect(stored.map((n) => n.status)).toEqual([
      NotificationStatus.FAILED,
      NotificationStatus.SENT,
      NotificationStatus.SENT,
      NotificationStatus.SENT,
    ]);
    expect(stored[0].error).toBe('DELIVERY_ERROR');
    expect(completed).toEqual(['ALERT']);
  });

  it('sends the all-clear only to people the alert reached, without location', async () => {
    contacts.failPriority = 1;
    await dispatcher.deliver({ incident, kind: 'ALERT' });
    contacts.failPriority = null;
    contacts.sent.length = 0;
    family.sent.length = 0;

    await dispatcher.deliver({
      incident: {
        ...incident,
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date('2026-10-03T10:02:00Z'),
        resolvedVia: 'APP',
      },
      kind: 'ALL_CLEAR',
    });

    expect(contacts.sent.map((s) => s.priority)).toEqual([2]);
    expect(family.sent).toHaveLength(2);
    expect(contacts.sent[0].message.location).toBeNull();
    expect(contacts.sent[0].message.resolvedVia).toBe('APP');
    expect(completed).toEqual(['ALERT', 'ALL_CLEAR']);
  });

  it('recognizes an SOS that escalated an existing medical incident', async () => {
    timeline = [
      {
        kind: IncidentTimelineKind.ESCALATED,
        at: incident.escalatedAt!,
        detail: { reason: 'SOS' },
      },
    ];
    await dispatcher.deliver({ incident, kind: 'ALERT' });
    expect(contacts.sent[0].message.alertReason).toBe('SOS');
  });

  it('recognizes a directly opened SOS without relying on timeline details', async () => {
    timeline = [];
    await dispatcher.deliver({
      incident: { ...incident, triggerType: MedicalEventType.SOS },
      kind: 'ALERT',
    });
    expect(contacts.sent[0].message.alertReason).toBe('SOS');
  });

  it('does not invent an escalation reason when the history is missing', async () => {
    timeline = [];
    await dispatcher.deliver({ incident, kind: 'ALERT' });
    expect(contacts.sent[0].message.alertReason).toBeUndefined();
  });

  it('still delivers the alert if optional escalation wording cannot be loaded', async () => {
    timelineUnavailable = true;
    await dispatcher.deliver({ incident, kind: 'ALERT' });
    expect(contacts.sent).toHaveLength(2);
    expect(contacts.sent[0].message.alertReason).toBeUndefined();
    expect(completed).toEqual(['ALERT']);
  });
});
