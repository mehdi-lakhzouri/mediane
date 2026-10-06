import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationRetentionJob } from './application/notification-retention.job';
import { NotificationsService } from './application/notifications.service';
import { NotificationRepository } from './domain/notification.repository';
import { NoopPushGateway, PushGateway } from './domain/push-gateway';
import { PrismaNotificationRepository } from './infrastructure/prisma-notification.repository';
import { AdminAnnouncementsController } from './presentation/admin-announcements.controller';
import { NotificationsController } from './presentation/notifications.controller';

/**
 * In-app notification center. A leaf module: auth, MFA, families, devices
 * and safety depend on it to tell users things; it depends on none of them.
 */
@Module({
  imports: [AuditModule],
  controllers: [NotificationsController, AdminAnnouncementsController],
  providers: [
    NotificationsService,
    NotificationRetentionJob,
    { provide: NotificationRepository, useClass: PrismaNotificationRepository },
    // In-app only for now; swap for an FCM/APNs gateway later.
    { provide: PushGateway, useClass: NoopPushGateway },
  ],
  exports: [NotificationsService, NotificationRetentionJob],
})
export class NotificationsModule {}
