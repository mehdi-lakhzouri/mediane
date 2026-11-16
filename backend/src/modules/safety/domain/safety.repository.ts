import type {
  IncidentRecord,
  IncidentStatus,
  IncidentTimelineKind,
  TimelineEntry,
} from './incident';
import type { NotificationAttempt, NotificationRecord } from './notification';
import type {
  GeoPoint,
  IncidentActorChannel,
  MedicalEventSeverity,
  MedicalEventSource,
  MedicalEventType,
  Vitals,
} from './safety';

export interface MedicalEventRecord {
  id: string;
  userId: string;
  deviceId: string | null;
  incidentId: string | null;
  source: MedicalEventSource;
  type: MedicalEventType;
  severity: MedicalEventSeverity;
  clientEventId: string;
  confidence: number | null;
  detection?: import('./ai-detection').AiDetection | null;
  payloadHash?: string | null;
  detectedAt: Date;
  receivedAt: Date;
  vitals: Vitals | null;
  location: GeoPoint | null;
}

export type NewMedicalEvent = Omit<MedicalEventRecord, 'id' | 'receivedAt'> & {
  receivedAt: Date;
};

export interface MedicalEventFilter {
  page: number;
  pageSize: number;
  type?: MedicalEventType;
}

/** Port. Reads are always scoped to the owning driver. */
export abstract class MedicalEventRepository {
  abstract findByClientId(
    userId: string,
    clientEventId: string,
  ): Promise<MedicalEventRecord | null>;

  abstract create(event: NewMedicalEvent): Promise<MedicalEventRecord>;

  abstract findOwn(
    userId: string,
    eventId: string,
  ): Promise<MedicalEventRecord | null>;

  /** Newest detection first. */
  abstract listOwn(
    userId: string,
    filter: MedicalEventFilter,
  ): Promise<{ items: MedicalEventRecord[]; totalItems: number }>;

  abstract latestOwn(userId: string): Promise<MedicalEventRecord | null>;

  /** Oldest first: the order things happened. */
  abstract listForIncident(incidentId: string): Promise<MedicalEventRecord[]>;

  abstract deleteReceivedBefore(before: Date): Promise<number>;
}

export type NewIncident = Omit<
  IncidentRecord,
  'id' | 'acknowledgedAt' | 'acknowledgedVia' | 'resolvedAt' | 'resolvedVia'
>;

export type IncidentChanges = Partial<
  Pick<
    IncidentRecord,
    | 'status'
    | 'severity'
    | 'triggerType'
    | 'respondBy'
    | 'acknowledgedAt'
    | 'acknowledgedVia'
    | 'escalatedAt'
    | 'resolvedAt'
    | 'resolvedVia'
    | 'location'
  >
>;

/** Delivery work an escalation worker has leased. */
export interface DispatchClaim {
  incident: IncidentRecord;
  kind: 'ALERT' | 'ALL_CLEAR';
}

/** Port. */
export abstract class IncidentRepository {
  /**
   * Serializes safety writes of one driver until the transaction ends
   * (concurrent detections, SOS and "I'm OK"). Must run in a UnitOfWork.
   */
  abstract lockDriver(userId: string): Promise<void>;

  abstract findActive(userId: string): Promise<IncidentRecord | null>;

  abstract findById(incidentId: string): Promise<IncidentRecord | null>;

  abstract findOwn(
    userId: string,
    incidentId: string,
  ): Promise<IncidentRecord | null>;

  abstract listOwn(
    userId: string,
    filter: { page: number; pageSize: number },
  ): Promise<{ items: IncidentRecord[]; totalItems: number }>;

  /**
   * Incidents that reached other people (escalated at some point): those
   * still escalated, plus those opened since `since`. Newest first. A
   * cancelled alarm never appears: nobody was called.
   */
  abstract listEscalatedForUsers(
    userIds: readonly string[],
    since: Date,
  ): Promise<IncidentRecord[]>;

  abstract create(incident: NewIncident): Promise<IncidentRecord>;

  /**
   * Applies the changes only while the incident is still in one of `from`
   * (compare-and-set); `null` when it moved on meanwhile.
   */
  abstract transition(
    incidentId: string,
    from: readonly IncidentStatus[],
    changes: IncidentChanges,
  ): Promise<IncidentRecord | null>;

  abstract addTimeline(
    incidentId: string,
    kind: IncidentTimelineKind,
    at: Date,
    detail?: TimelineEntry['detail'],
  ): Promise<void>;

  abstract listTimeline(incidentId: string): Promise<TimelineEntry[]>;

  /**
   * Atomically moves every incident whose answer is overdue to ESCALATED and
   * returns them. Safe with several workers: each incident is claimed once.
   */
  abstract escalateOverdue(now: Date, limit: number): Promise<IncidentRecord[]>;

  /**
   * Leases incidents with undelivered alerts or all-clears until
   * `leaseUntil`. An unfinished lease expires, so a crash never loses an alert.
   */
  abstract claimDispatch(
    now: Date,
    leaseUntil: Date,
    limit: number,
  ): Promise<DispatchClaim[]>;

  abstract completeDispatch(
    incidentId: string,
    kind: DispatchClaim['kind'],
    at: Date,
  ): Promise<void>;

  /** Closes incidents escalated before `escalatedBefore`; returns them. */
  abstract autoClose(
    escalatedBefore: Date,
    now: Date,
    via: IncidentActorChannel,
  ): Promise<{ id: string; userId: string }[]>;

  abstract addNotifications(
    incidentId: string,
    attempts: readonly NotificationAttempt[],
  ): Promise<void>;

  abstract listNotifications(incidentId: string): Promise<NotificationRecord[]>;

  /** Settled incidents only. */
  abstract deleteOpenedBefore(before: Date): Promise<number>;

  /** Location is kept no longer than event details. */
  abstract clearLocationsOpenedBefore(before: Date): Promise<number>;
}
