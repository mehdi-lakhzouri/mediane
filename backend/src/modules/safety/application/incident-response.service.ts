import { Injectable } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { AuditService } from '../../audit/application/audit.service';
import {
  ACTIVE_INCIDENT_STATUSES,
  type IncidentRecord,
  IncidentStatus,
  IncidentTimelineKind,
  statusAfterAcknowledge,
} from '../domain/incident';
import {
  type GeoPoint,
  IncidentActorChannel,
  MedicalEventSource,
  MedicalEventType,
} from '../domain/safety';
import {
  IncidentNotFoundError,
  NoActiveIncidentError,
} from '../domain/safety.errors';
import { IncidentRepository } from '../domain/safety.repository';
import { EventIngestionService } from './event-ingestion.service';
import { SafetyScheduler } from './safety-scheduler';

/** Which incident an "I'm OK" answers. */
export type AcknowledgeTarget =
  | { incidentId: string }
  /** The cabin button: whatever is open for the driver right now. */
  | { active: true };

/**
 * What the driver can do about an incident: say "I'm OK" (from the app or
 * the cabin button) or call for help. Family members cannot cancel.
 */
@Injectable()
export class IncidentResponseService {
  constructor(
    private readonly incidents: IncidentRepository,
    private readonly ingestion: EventIngestionService,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditService,
    private readonly scheduler: SafetyScheduler,
  ) {}

  /**
   * Before escalation the alarm is cancelled (FALSE_ALARM); after it, the
   * incident is resolved and everyone alerted gets an all-clear. Repeating
   * the answer on a closed incident returns it unchanged (safe retries).
   */
  async acknowledge(
    userId: string,
    target: AcknowledgeTarget,
    via: IncidentActorChannel,
    client?: ClientContext,
    now: Date = new Date(),
  ): Promise<IncidentRecord> {
    const result = await this.unitOfWork.run(async () => {
      await this.incidents.lockDriver(userId);
      const incident =
        'incidentId' in target
          ? await this.incidents.findOwn(userId, target.incidentId)
          : await this.incidents.findActive(userId);
      if (!incident) {
        throw 'incidentId' in target
          ? new IncidentNotFoundError()
          : new NoActiveIncidentError();
      }
      const next = statusAfterAcknowledge(incident.status);
      if (!next) return { incident, allClear: false };

      const updated = await this.incidents.transition(
        incident.id,
        ACTIVE_INCIDENT_STATUSES,
        {
          status: next,
          respondBy: null,
          acknowledgedAt: now,
          acknowledgedVia: via,
          resolvedAt: now,
          resolvedVia: via,
        },
      );
      // The driver lock makes a lost race impossible; stay defensive anyway.
      if (!updated) return { incident, allClear: false };

      await this.incidents.addTimeline(
        incident.id,
        IncidentTimelineKind.ACKNOWLEDGED,
        now,
        { via },
      );
      await this.incidents.addTimeline(
        incident.id,
        IncidentTimelineKind.RESOLVED,
        now,
        { outcome: next },
      );
      await this.audit.record({
        action: 'INCIDENT_ACKNOWLEDGED',
        actor:
          via === IncidentActorChannel.DEVICE
            ? { type: 'DEVICE', userId: null }
            : { type: 'USER', userId },
        target: { type: 'INCIDENT', id: incident.id },
        client,
        metadata: { via, outcome: next },
      });
      return {
        incident: updated,
        allClear: next === IncidentStatus.RESOLVED,
      };
    });

    if (result.allClear) this.scheduler.nudge();
    return result.incident;
  }

  /**
   * Manual SOS from the app, after its hold-and-cancel window. Escalates at
   * once; a retry with the same id returns the same incident.
   */
  async triggerSos(
    userId: string,
    input: { clientEventId: string; location: GeoPoint | null },
    client?: ClientContext,
    now: Date = new Date(),
  ): Promise<IncidentRecord> {
    const { incident } = await this.ingestion.report(
      {
        userId,
        source: MedicalEventSource.DRIVER,
        deviceId: null,
        type: MedicalEventType.SOS,
        clientEventId: input.clientEventId,
        detectedAt: now,
        confidence: null,
        vitals: null,
        location: input.location,
      },
      client,
      now,
    );
    // An SOS always belongs to an incident; anything else is a bug.
    if (!incident) throw new Error('SOS was recorded without an incident');
    return incident;
  }
}
