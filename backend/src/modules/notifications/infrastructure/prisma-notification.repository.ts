import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import {
  type ComposedNotification,
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
  type NotificationRecord,
} from '../domain/notification';
import {
  type NotificationFilter,
  NotificationRepository,
} from '../domain/notification.repository';

const NOTIFICATION_SELECT = {
  id: true,
  userId: true,
  category: true,
  type: true,
  title: true,
  body: true,
  link: true,
  critical: true,
  readAt: true,
  createdAt: true,
} as const satisfies Prisma.UserNotificationSelect;

const PREFERENCE_SELECT = {
  safety: true,
  family: true,
  account: true,
  showNamesOnLockScreen: true,
} as const satisfies Prisma.NotificationPreferenceSelect;

@Injectable()
export class PrismaNotificationRepository extends NotificationRepository {
  constructor(private readonly db: PrismaTransactionHost) {
    super();
  }

  async createMany(
    entries: readonly (ComposedNotification & { userId: string })[],
  ): Promise<number> {
    const { count } = await this.db.client.userNotification.createMany({
      data: [...entries],
    });
    return count;
  }

  async list(
    userId: string,
    filter: NotificationFilter,
  ): Promise<{ items: NotificationRecord[]; totalItems: number }> {
    const where = {
      userId,
      ...(filter.unreadOnly ? { readAt: null } : {}),
      ...(filter.category ? { category: filter.category } : {}),
    } satisfies Prisma.UserNotificationWhereInput;
    const [items, totalItems] = await Promise.all([
      this.db.client.userNotification.findMany({
        where,
        select: NOTIFICATION_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.db.client.userNotification.count({ where }),
    ]);
    return { items, totalItems };
  }

  countUnread(userId: string): Promise<number> {
    return this.db.client.userNotification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(
    userId: string,
    notificationId: string,
    at: Date,
  ): Promise<boolean> {
    const exists = await this.db.client.userNotification.count({
      where: { id: notificationId, userId },
    });
    if (!exists) return false;
    // Reading twice keeps the first read time.
    await this.db.client.userNotification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: at },
    });
    return true;
  }

  async markAllRead(userId: string, at: Date): Promise<number> {
    const { count } = await this.db.client.userNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: at },
    });
    return count;
  }

  async deleteCreatedBefore(before: Date): Promise<number> {
    const { count } = await this.db.client.userNotification.deleteMany({
      where: { createdAt: { lt: before } },
    });
    return count;
  }

  async preferencesOf(
    userIds: readonly string[],
  ): Promise<Map<string, NotificationPreferences>> {
    const rows = await this.db.client.notificationPreference.findMany({
      where: { userId: { in: [...userIds] } },
      select: { userId: true, ...PREFERENCE_SELECT },
    });
    const byUser = new Map(rows.map(({ userId, ...prefs }) => [userId, prefs]));
    return new Map(
      userIds.map((id) => [id, byUser.get(id) ?? { ...DEFAULT_PREFERENCES }]),
    );
  }

  savePreferences(
    userId: string,
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    return this.db.client.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...preferences },
      update: preferences,
      select: PREFERENCE_SELECT,
    });
  }

  async activeDriverIds(): Promise<string[]> {
    const rows = await this.db.client.user.findMany({
      where: {
        role: 'DRIVER',
        status: 'ACTIVE',
        deletedAt: null,
        suspendedAt: null,
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
