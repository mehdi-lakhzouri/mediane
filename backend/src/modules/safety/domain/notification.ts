import type { GeoPoint } from './safety';

export const NotificationKind = {
  ALERT: 'ALERT',
  ALL_CLEAR: 'ALL_CLEAR',
} as const;
export type NotificationKind =
  (typeof NotificationKind)[keyof typeof NotificationKind];

export const NotificationRecipientType = {
  EMERGENCY_CONTACT: 'EMERGENCY_CONTACT',
  FAMILY_MEMBER: 'FAMILY_MEMBER',
} as const;
export type NotificationRecipientType =
  (typeof NotificationRecipientType)[keyof typeof NotificationRecipientType];

export const NotificationChannel = {
  LOG: 'LOG',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  VOICE: 'VOICE',
  PUSH: 'PUSH',
} as const;
export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
  SENT: 'SENT',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;
export type NotificationStatus =
  (typeof NotificationStatus)[keyof typeof NotificationStatus];

/** One attempt to reach someone, as stored for the driver to see. */
export interface NotificationAttempt {
  kind: NotificationKind;
  recipientType: NotificationRecipientType;
  recipientUserId: string | null;
  recipientName: string;
  priority: number | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  /** Short, non-sensitive reason code when not sent. */
  error: string | null;
  attemptedAt: Date;
}

export type NotificationRecord = NotificationAttempt & { id: string };

/** Everyone to reach for a driver's incident. */
export interface IncidentRecipients {
  driver: { firstName: string; lastName: string };
  /** Ordered by priority, 1 first. */
  contacts: readonly {
    fullName: string;
    phoneNumber: string;
    priority: number;
  }[];
  /** Other members of the driver's family, when the driver shares incidents. */
  family: readonly {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
  }[];
}

/** What a channel needs to deliver one message. */
export interface EmergencyMessage {
  kind: NotificationKind;
  incidentId: string;
  driver: { firstName: string; lastName: string };
  /** Only for alerts, and only when the unit reported one. */
  location: GeoPoint | null;
  occurredAt: Date;
}

export interface DeliveryResult {
  status: NotificationStatus;
  error?: string;
}

/**
 * Port for reaching emergency contacts (phone numbers, no account). Logs for
 * now; an SMS or voice provider plugs in here without touching escalation.
 * Implementations must never log names, numbers, locations or medical data.
 */
export abstract class EmergencyContactChannel {
  abstract readonly channel: NotificationChannel;

  abstract deliver(
    message: EmergencyMessage,
    contact: { fullName: string; phoneNumber: string; priority: number },
  ): Promise<DeliveryResult>;
}

/** Port for reaching family members (they have accounts and an email). */
export abstract class FamilyAlertChannel {
  abstract readonly channel: NotificationChannel;

  abstract deliver(
    message: EmergencyMessage,
    member: { firstName: string; email: string },
  ): Promise<DeliveryResult>;
}

/** Read port: who to reach for a driver, and whose incidents a member may see. */
export abstract class SafetyDirectory {
  abstract recipientsFor(userId: string): Promise<IncidentRecipients>;

  /**
   * Members of the viewer's family (viewer excluded) who share incidents
   * with it. Empty when the viewer has no family.
   */
  abstract peersSharingIncidents(
    viewerId: string,
  ): Promise<{ userId: string; firstName: string; lastName: string }[]>;
}
