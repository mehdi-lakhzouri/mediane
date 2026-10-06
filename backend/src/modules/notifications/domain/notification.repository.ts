import type {
  ComposedNotification,
  NotificationCategory,
  NotificationPreferences,
  NotificationRecord,
} from './notification';

export interface NotificationFilter {
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
  category?: NotificationCategory;
}

/** Port. Reads and writes are always scoped to the owning user. */
export abstract class NotificationRepository {
  abstract createMany(
    entries: readonly (ComposedNotification & { userId: string })[],
  ): Promise<number>;

  /** Newest first. */
  abstract list(
    userId: string,
    filter: NotificationFilter,
  ): Promise<{ items: NotificationRecord[]; totalItems: number }>;

  abstract countUnread(userId: string): Promise<number>;

  /** @returns false when the notification does not exist for this user. */
  abstract markRead(
    userId: string,
    notificationId: string,
    at: Date,
  ): Promise<boolean>;

  abstract markAllRead(userId: string, at: Date): Promise<number>;

  abstract deleteCreatedBefore(before: Date): Promise<number>;

  /** Missing users get the defaults. */
  abstract preferencesOf(
    userIds: readonly string[],
  ): Promise<Map<string, NotificationPreferences>>;

  abstract savePreferences(
    userId: string,
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences>;

  /** Active drivers, for announcements. */
  abstract activeDriverIds(): Promise<string[]>;
}
