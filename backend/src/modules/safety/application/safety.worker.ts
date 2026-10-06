import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { safetyConfig, type SafetyConfig } from '../../../config';
import { DeviceHealthMonitor } from '../../devices/application/device-health.monitor';
import { EscalationService } from './escalation.service';
import { SafetyRetentionService } from './safety-retention.service';
import { SafetyScheduler } from './safety-scheduler';

const RETENTION_INTERVAL_MS = 3_600_000;

/**
 * In-process timer driving escalation. Passes never overlap; a nudge during
 * a pass schedules one more right after. Disabled in tests, which call the
 * services directly.
 */
@Injectable()
export class SafetyWorker
  extends SafetyScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SafetyWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private again = false;
  private lastRetention = 0;

  constructor(
    private readonly escalation: EscalationService,
    private readonly retention: SafetyRetentionService,
    private readonly deviceHealth: DeviceHealthMonitor,
    @Inject(safetyConfig.KEY) private readonly config: SafetyConfig,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    if (!this.config.workerEnabled) return;
    this.timer = setInterval(
      () => void this.tick(),
      this.config.workerIntervalMs,
    );
    this.timer.unref();
    void this.tick();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  nudge(): void {
    if (!this.timer) return;
    setImmediate(() => void this.tick());
  }

  private async tick(): Promise<void> {
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.again = false;
        await this.escalation.runOnce();
      } while (this.again);
      await this.deviceHealth.reportOffline();
      if (Date.now() - this.lastRetention >= RETENTION_INTERVAL_MS) {
        this.lastRetention = Date.now();
        await this.retention.purge();
      }
    } catch (error) {
      this.logger.error(
        'Safety worker pass failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
