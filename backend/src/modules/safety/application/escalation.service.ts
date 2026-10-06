import { Inject, Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { safetyConfig, type SafetyConfig } from '../../../config';
import { AuditService } from '../../audit/application/audit.service';
import { IncidentStatus, IncidentTimelineKind } from '../domain/incident';
import { IncidentActorChannel } from '../domain/safety';
import { IncidentRepository } from '../domain/safety.repository';
import { EmergencyDispatcher } from './emergency-dispatcher';

const BATCH_SIZE = 50;
/** How long one worker owns a delivery before another may retry it. */
const DISPATCH_LEASE_MS = 60_000;

/**
 * The time-driven half of the safety flow. Every step is a single atomic
 * claim in the database, so several API instances can run it side by side.
 */
@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly incidents: IncidentRepository,
    private readonly dispatcher: EmergencyDispatcher,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditService,
    private readonly inbox: NotificationsService,
    @Inject(safetyConfig.KEY) private readonly config: SafetyConfig,
  ) {}

  /** One full pass: escalate overdue answers, deliver, close stale incidents. */
  async runOnce(now: Date = new Date()): Promise<void> {
    await this.escalateOverdue(now);
    await this.dispatchPending(now);
    await this.autoClose(now);
  }

  /** Incidents whose countdown ran out without an answer. */
  async escalateOverdue(now: Date = new Date()): Promise<number> {
    return this.unitOfWork.run(async () => {
      const escalated = await this.incidents.escalateOverdue(now, BATCH_SIZE);
      for (const incident of escalated) {
        await this.incidents.addTimeline(
          incident.id,
          IncidentTimelineKind.ESCALATED,
          now,
          { reason: 'NO_RESPONSE' },
        );
        await this.audit.record({
          action: 'INCIDENT_ESCALATED',
          actor: { type: 'SYSTEM' },
          target: { type: 'INCIDENT', id: incident.id },
          metadata: { reason: 'NO_RESPONSE' },
        });
      }
      return escalated.length;
    });
  }

  /** Alerts and all-clears not delivered yet, including after a crash. */
  async dispatchPending(now: Date = new Date()): Promise<number> {
    const claims = await this.incidents.claimDispatch(
      now,
      new Date(now.getTime() + DISPATCH_LEASE_MS),
      BATCH_SIZE,
    );
    for (const claim of claims) {
      try {
        await this.dispatcher.deliver(claim, now);
      } catch (error) {
        // The lease expires and the next pass retries.
        this.logger.error(
          `Incident ${claim.incident.id}: ${claim.kind} dispatch failed`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    return claims.length;
  }

  /** Escalated incidents nobody closed: the episode is over by now. */
  async autoClose(now: Date = new Date()): Promise<number> {
    const before = new Date(
      now.getTime() - this.config.autoCloseHours * 3_600_000,
    );
    return this.unitOfWork.run(async () => {
      const closed = await this.incidents.autoClose(
        before,
        now,
        IncidentActorChannel.SYSTEM,
      );
      for (const { id, userId } of closed) {
        await this.incidents.addTimeline(
          id,
          IncidentTimelineKind.RESOLVED,
          now,
          {
            outcome: IncidentStatus.RESOLVED,
            via: IncidentActorChannel.SYSTEM,
          },
        );
        await this.audit.record({
          action: 'INCIDENT_RESOLVED',
          actor: { type: 'SYSTEM' },
          target: { type: 'INCIDENT', id },
          metadata: { via: IncidentActorChannel.SYSTEM },
        });
        await this.inbox.notify(userId, {
          type: 'OWN_ALERT_AUTO_CLOSED',
          incidentId: id,
        });
      }
      return closed.length;
    });
  }
}
