import { Injectable } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { AuditService } from '../../audit/application/audit.service';
import { lockScreenPreview } from '../domain/lock-screen-preview';
import {
  type NotificationPreferences,
  NotificationPolicy,
  type NotificationRecord,
} from '../domain/notification';
import {
  composeNotification,
  type NotificationMessage,
} from '../domain/notification-catalog';
import { NotificationNotFoundError } from '../domain/notification.errors';
import {
  type NotificationFilter,
  NotificationRepository,
} from '../domain/notification.repository';
import { PushGateway } from '../domain/push-gateway';

/**
 * The single way features tell users something. Applies each recipient's
 * mute settings, stores the entry in their center, and hands a lock-screen
 * safe preview to push. Called inside the caller's transaction when there
 * is one, so a notification exists only if what it reports happened.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly push: PushGateway,
    private readonly audit: AuditService,
  ) {}

  /** @returns how many recipients will see it. */
  async notify(
    recipients: string | readonly string[],
    message: NotificationMessage,
  ): Promise<number> {
    const userIds = [
      ...new Set(typeof recipients === 'string' ? [recipients] : recipients),
    ];
    if (userIds.length === 0) return 0;

    const composed = composeNotification(message);
    const preferences = await this.notifications.preferencesOf(userIds);
    const delivered = userIds.filter((userId) =>
      NotificationPolicy.shouldDeliver(composed, preferences.get(userId)!),
    );
    if (delivered.length === 0) return 0;

    await this.notifications.createMany(
      delivered.map((userId) => ({ ...composed, userId })),
    );
    await Promise.all(
      delivered.map((userId) =>
        this.push.send(
          userId,
          lockScreenPreview(composed, preferences.get(userId)!),
          { link: composed.link },
        ),
      ),
    );
    return delivered.length;
  }

  list(
    userId: string,
    filter: NotificationFilter,
  ): Promise<{ items: NotificationRecord[]; totalItems: number }> {
    return this.notifications.list(userId, filter);
  }

  unreadCount(userId: string): Promise<number> {
    return this.notifications.countUnread(userId);
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const found = await this.notifications.markRead(
      userId,
      notificationId,
      new Date(),
    );
    if (!found) throw new NotificationNotFoundError();
  }

  markAllRead(userId: string): Promise<number> {
    return this.notifications.markAllRead(userId, new Date());
  }

  async preferences(userId: string): Promise<NotificationPreferences> {
    return (await this.notifications.preferencesOf([userId])).get(userId)!;
  }

  updatePreferences(
    userId: string,
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    return this.notifications.savePreferences(userId, preferences);
  }

  /** Administrator message to every active driver. */
  async announce(
    input: { title: string; body: string },
    actor: { adminId: string; client: ClientContext },
  ): Promise<number> {
    const drivers = await this.notifications.activeDriverIds();
    const sent = await this.notify(drivers, {
      type: 'ANNOUNCEMENT',
      title: input.title,
      body: input.body,
    });
    await this.audit.record({
      action: 'ANNOUNCEMENT_SENT',
      actor: { type: 'USER', userId: actor.adminId },
      client: actor.client,
      metadata: { recipients: sent },
    });
    return sent;
  }
}
