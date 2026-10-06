import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { appConfig, type AppConfig } from '../../../config';
import { NotificationPolicy } from '../domain/notification';
import { NotificationRepository } from '../domain/notification.repository';

const INTERVAL_MS = 3_600_000;

/** Removes notifications older than the retention period, hourly. */
@Injectable()
export class NotificationRetentionJob
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(NotificationRetentionJob.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly notifications: NotificationRepository,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    // Tests call purge() directly.
    if (this.app.isTest) return;
    this.timer = setInterval(() => void this.purge(), INTERVAL_MS);
    this.timer.unref();
    void this.purge();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async purge(now: Date = new Date()): Promise<number> {
    try {
      const removed = await this.notifications.deleteCreatedBefore(
        new Date(
          now.getTime() - NotificationPolicy.RETENTION_DAYS * 86_400_000,
        ),
      );
      if (removed > 0) this.logger.log(`Removed ${removed} old notifications`);
      return removed;
    } catch (error) {
      this.logger.error(
        'Notification retention failed',
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    }
  }
}
