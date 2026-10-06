import { Inject, Injectable, Logger } from '@nestjs/common';
import { safetyConfig, type SafetyConfig } from '../../../config';
import { DeviceRepository } from '../../devices/domain/device.repository';
import {
  IncidentRepository,
  MedicalEventRepository,
} from '../domain/safety.repository';

const DAY_MS = 86_400_000;

export interface RetentionReport {
  events: number;
  incidentLocations: number;
  incidents: number;
  nonces: number;
}

/**
 * Event details (readings, location) live for the event retention period;
 * incident summaries for the incident retention period. Expired replay
 * nonces go too.
 */
@Injectable()
export class SafetyRetentionService {
  private readonly logger = new Logger(SafetyRetentionService.name);

  constructor(
    private readonly events: MedicalEventRepository,
    private readonly incidents: IncidentRepository,
    private readonly devices: DeviceRepository,
    @Inject(safetyConfig.KEY) private readonly config: SafetyConfig,
  ) {}

  async purge(now: Date = new Date()): Promise<RetentionReport> {
    const eventCutoff = new Date(
      now.getTime() - this.config.eventRetentionDays * DAY_MS,
    );
    const incidentCutoff = new Date(
      now.getTime() - this.config.incidentRetentionDays * DAY_MS,
    );
    const report: RetentionReport = {
      events: await this.events.deleteReceivedBefore(eventCutoff),
      incidentLocations:
        await this.incidents.clearLocationsOpenedBefore(eventCutoff),
      incidents: await this.incidents.deleteOpenedBefore(incidentCutoff),
      nonces: await this.devices.purgeNonces(now),
    };
    if (Object.values(report).some((count) => count > 0)) {
      this.logger.log(
        `Safety retention: ${report.events} events, ${report.incidentLocations} incident locations, ${report.incidents} incidents, ${report.nonces} nonces removed`,
      );
    }
    return report;
  }
}
