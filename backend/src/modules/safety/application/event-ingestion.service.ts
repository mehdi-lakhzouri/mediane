import { Inject, Injectable } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { safetyConfig, type SafetyConfig } from '../../../config';
import { AuditService } from '../../audit/application/audit.service';
import type { AuditEntry } from '../../audit/domain/audit-entry';
import {
  type IncidentRecord,
  IncidentStatus,
  IncidentTimelineKind,
  tightenedDeadline,
} from '../domain/incident';
import {
  type GeoPoint,
  MedicalEventSeverity,
  MedicalEventSource,
  MedicalEventType,
  SafetyLimits,
  SeverityPolicy,
  type Vitals,
} from '../domain/safety';
import {
  EventIdConflictError,
  EventTimestampError,
} from '../domain/safety.errors';
import {
  IncidentRepository,
  type MedicalEventRecord,
  MedicalEventRepository,
} from '../domain/safety.repository';
import { SafetyScheduler } from './safety-scheduler';

export interface ReportedEvent {
  userId: string;
  source: MedicalEventSource;
  deviceId: string | null;
  type: MedicalEventType;
  /** Sender-chosen idempotency key. */
  clientEventId: string;
  /** When the unit detected it (its own clock). */
  detectedAt: Date;
  confidence: number | null;
  vitals: Vitals | null;
  location: GeoPoint | null;
}

export interface IngestionResult {
  event: MedicalEventRecord;
  incident: IncidentRecord | null;
  /** The event had already been received; nothing changed. */
  duplicate: boolean;
}

/**
 * Turns detections and SOS presses into events and incidents. Every write
 * for a driver is serialized, so concurrent reports cannot open two
 * incidents or lose an upgrade. Replays of the same event id are no-ops.
 */
@Injectable()
export class EventIngestionService {
  constructor(
    private readonly events: MedicalEventRepository,
    private readonly incidents: IncidentRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditService,
    private readonly scheduler: SafetyScheduler,
    @Inject(safetyConfig.KEY) private readonly config: SafetyConfig,
  ) {}

  async report(
    reported: ReportedEvent,
    client?: ClientContext,
    now: Date = new Date(),
  ): Promise<IngestionResult> {
    assertPlausibleTime(reported.detectedAt, now);

    const known = await this.replayOf(reported);
    if (known) return known;

    const result = await this.unitOfWork.run(async () => {
      await this.incidents.lockDriver(reported.userId);
      // A concurrent request may have stored it while we waited for the lock.
      const raced = await this.replayOf(reported);
      if (raced) return { ...raced, escalatedNow: false };
      return this.record(reported, client, now);
    });

    if (result.escalatedNow) this.scheduler.nudge();
    return {
      event: result.event,
      incident: result.incident,
      duplicate: result.duplicate,
    };
  }

  private async record(
    reported: ReportedEvent,
    client: ClientContext | undefined,
    now: Date,
  ): Promise<IngestionResult & { escalatedNow: boolean }> {
    const severity = SeverityPolicy.severityOf(reported.type);
    const active = await this.incidents.findActive(reported.userId);
    let incident = active;
    let escalatedNow = false;

    if (active) {
      const updated = await this.applyToActive(
        active,
        reported,
        severity,
        client,
        now,
      );
      incident = updated.incident;
      escalatedNow = updated.escalatedNow;
      await this.incidents.addTimeline(
        active.id,
        IncidentTimelineKind.EVENT_ADDED,
        now,
        { source: reported.source },
      );
    } else if (SeverityPolicy.opensIncident(severity)) {
      incident = await this.open(reported, severity, client, now);
      escalatedNow = incident.status === IncidentStatus.ESCALATED;
    }

    const event = await this.events.create({
      userId: reported.userId,
      deviceId: reported.deviceId,
      incidentId: incident?.id ?? null,
      source: reported.source,
      type: reported.type,
      severity,
      clientEventId: reported.clientEventId,
      confidence: reported.confidence,
      detectedAt: reported.detectedAt,
      receivedAt: now,
      vitals: reported.vitals,
      location: reported.location,
    });
    return { event, incident, duplicate: false, escalatedNow };
  }

  private async open(
    reported: ReportedEvent,
    severity: MedicalEventSeverity,
    client: ClientContext | undefined,
    now: Date,
  ): Promise<IncidentRecord> {
    const sos = reported.type === MedicalEventType.SOS;
    const incident = await this.incidents.create({
      userId: reported.userId,
      status: sos ? IncidentStatus.ESCALATED : IncidentStatus.AWAITING_RESPONSE,
      severity,
      triggerType: reported.type,
      openedAt: now,
      respondBy: sos ? null : this.deadline(severity, now),
      escalatedAt: sos ? now : null,
      location: reported.location,
    });
    await this.incidents.addTimeline(
      incident.id,
      IncidentTimelineKind.OPENED,
      now,
      { source: reported.source },
    );
    if (sos) {
      await this.incidents.addTimeline(
        incident.id,
        IncidentTimelineKind.ESCALATED,
        now,
        { reason: 'SOS' },
      );
    }
    await this.audit.record({
      action: sos ? 'SOS_TRIGGERED' : 'INCIDENT_OPENED',
      ...actorOf(reported),
      target: { type: 'INCIDENT', id: incident.id },
      client,
    });
    return incident;
  }

  /**
   * A new report during an open incident: an SOS escalates at once, a more
   * severe detection raises the severity and can only shorten the countdown.
   */
  private async applyToActive(
    active: IncidentRecord,
    reported: ReportedEvent,
    severity: MedicalEventSeverity,
    client: ClientContext | undefined,
    now: Date,
  ): Promise<{ incident: IncidentRecord; escalatedNow: boolean }> {
    const location = reported.location ?? active.location;
    const awaiting = active.status === IncidentStatus.AWAITING_RESPONSE;

    if (awaiting && reported.type === MedicalEventType.SOS) {
      const escalated = await this.incidents.transition(
        active.id,
        [IncidentStatus.AWAITING_RESPONSE],
        {
          status: IncidentStatus.ESCALATED,
          severity: MedicalEventSeverity.CRITICAL,
          escalatedAt: now,
          respondBy: null,
          location,
        },
      );
      await this.incidents.addTimeline(
        active.id,
        IncidentTimelineKind.ESCALATED,
        now,
        { reason: 'SOS' },
      );
      await this.audit.record({
        action: 'SOS_TRIGGERED',
        ...actorOf(reported),
        target: { type: 'INCIDENT', id: active.id },
        client,
      });
      return { incident: escalated ?? active, escalatedNow: true };
    }

    const upgrade =
      awaiting && SeverityPolicy.isMoreSevere(severity, active.severity);
    if (!upgrade && !reported.location) {
      return { incident: active, escalatedNow: false };
    }
    const updated = await this.incidents.transition(
      active.id,
      [active.status],
      upgrade
        ? {
            severity,
            triggerType: reported.type,
            respondBy: tightenedDeadline(
              active.respondBy,
              this.deadline(severity, now),
            ),
            location,
          }
        : { location },
    );
    return { incident: updated ?? active, escalatedNow: false };
  }

  private deadline(severity: MedicalEventSeverity, now: Date): Date {
    const seconds = SeverityPolicy.responseSeconds(severity, this.config) ?? 0;
    return new Date(now.getTime() + seconds * 1000);
  }

  private async replayOf(
    reported: ReportedEvent,
  ): Promise<IngestionResult | null> {
    const existing = await this.events.findByClientId(
      reported.userId,
      reported.clientEventId,
    );
    if (!existing) return null;
    if (existing.type !== reported.type) throw new EventIdConflictError();
    const incident = existing.incidentId
      ? await this.incidents.findById(existing.incidentId)
      : null;
    return { event: existing, incident, duplicate: true };
  }
}

function assertPlausibleTime(detectedAt: Date, now: Date): void {
  const ageMs = now.getTime() - detectedAt.getTime();
  if (
    Number.isNaN(ageMs) ||
    ageMs > SafetyLimits.MAX_EVENT_AGE_HOURS * 3_600_000 ||
    -ageMs > SafetyLimits.MAX_CLOCK_SKEW_SECONDS * 1000
  ) {
    throw new EventTimestampError();
  }
}

function actorOf(reported: ReportedEvent): Pick<AuditEntry, 'actor'> {
  return reported.source === MedicalEventSource.DEVICE
    ? { actor: { type: 'DEVICE', userId: null } }
    : { actor: { type: 'USER', userId: reported.userId } };
}
