import type {
  GeoPoint,
  IncidentActorChannel,
  MedicalEventSeverity,
  MedicalEventType,
} from './safety';

/**
 *   AWAITING_RESPONSE --I'm OK--> FALSE_ALARM   (cancelled before anyone was called)
 *          |
 *      timeout / SOS
 *          v
 *      ESCALATED --I'm OK / auto-close--> RESOLVED
 */
export const IncidentStatus = {
  AWAITING_RESPONSE: 'AWAITING_RESPONSE',
  ESCALATED: 'ESCALATED',
  RESOLVED: 'RESOLVED',
  FALSE_ALARM: 'FALSE_ALARM',
} as const;
export type IncidentStatus =
  (typeof IncidentStatus)[keyof typeof IncidentStatus];

export const ACTIVE_INCIDENT_STATUSES: readonly IncidentStatus[] = [
  IncidentStatus.AWAITING_RESPONSE,
  IncidentStatus.ESCALATED,
];

export function isActiveIncident(status: IncidentStatus): boolean {
  return ACTIVE_INCIDENT_STATUSES.includes(status);
}

export const IncidentTimelineKind = {
  OPENED: 'OPENED',
  EVENT_ADDED: 'EVENT_ADDED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  ESCALATED: 'ESCALATED',
  NOTIFIED: 'NOTIFIED',
  RESOLVED: 'RESOLVED',
} as const;
export type IncidentTimelineKind =
  (typeof IncidentTimelineKind)[keyof typeof IncidentTimelineKind];

export interface IncidentRecord {
  id: string;
  userId: string;
  status: IncidentStatus;
  severity: MedicalEventSeverity;
  triggerType: MedicalEventType;
  openedAt: Date;
  respondBy: Date | null;
  acknowledgedAt: Date | null;
  acknowledgedVia: IncidentActorChannel | null;
  escalatedAt: Date | null;
  resolvedAt: Date | null;
  resolvedVia: IncidentActorChannel | null;
  location: GeoPoint | null;
}

export interface TimelineEntry {
  kind: IncidentTimelineKind;
  at: Date;
  /** Non-medical context only (channel, recipient counts). */
  detail: Record<string, string | number | boolean | null> | null;
}

/** The state an "I'm OK" answer leads to, or null when there is nothing to answer. */
export function statusAfterAcknowledge(
  status: IncidentStatus,
): IncidentStatus | null {
  switch (status) {
    case IncidentStatus.AWAITING_RESPONSE:
      return IncidentStatus.FALSE_ALARM;
    case IncidentStatus.ESCALATED:
      return IncidentStatus.RESOLVED;
    default:
      return null;
  }
}

/**
 * Countdown for a new detection on an incident still awaiting an answer: a
 * more severe event can only shorten it, never extend it.
 */
export function tightenedDeadline(current: Date | null, candidate: Date): Date {
  return current && current < candidate ? current : candidate;
}
