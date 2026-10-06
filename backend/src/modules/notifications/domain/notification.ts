export const NotificationCategory = {
  SAFETY: 'SAFETY',
  FAMILY: 'FAMILY',
  SECURITY: 'SECURITY',
  ACCOUNT: 'ACCOUNT',
} as const;
export type NotificationCategory =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];

export interface NotificationRecord {
  id: string;
  userId: string;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  link: string | null;
  critical: boolean;
  readAt: Date | null;
  createdAt: Date;
}

/** What gets stored: the composed content of one notification. */
export interface ComposedNotification {
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  link: string | null;
  critical: boolean;
}

export interface NotificationPreferences {
  safety: boolean;
  family: boolean;
  account: boolean;
  showNamesOnLockScreen: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  safety: true,
  family: true,
  account: true,
  showNamesOnLockScreen: false,
};

export const NotificationPolicy = {
  RETENTION_DAYS: 90,
  /**
   * Whether a user receives a notification. Family emergencies (critical)
   * always arrive; security has no mute switch, so an unexpected sign-in or
   * password change is never missed.
   */
  shouldDeliver(
    notification: Pick<ComposedNotification, 'category' | 'critical'>,
    preferences: NotificationPreferences,
  ): boolean {
    if (notification.critical) return true;
    switch (notification.category) {
      case NotificationCategory.SECURITY:
        return true;
      case NotificationCategory.SAFETY:
        return preferences.safety;
      case NotificationCategory.FAMILY:
        return preferences.family;
      case NotificationCategory.ACCOUNT:
        return preferences.account;
    }
  },
} as const;
