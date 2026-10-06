import {
  type ComposedNotification,
  NotificationCategory,
  type NotificationPreferences,
} from './notification';

export interface LockScreenPreview {
  title: string;
  body: string;
}

const GENERIC_BODY: Record<NotificationCategory, string> = {
  SAFETY: 'You have a new safety alert.',
  FAMILY: 'There is news from your family.',
  SECURITY: 'There is a security update on your account.',
  ACCOUNT: 'You have a new message.',
};

/**
 * What a push may show on a locked phone. By default nothing personal: a
 * generic line per category. With the driver's opt-in, the title (which can
 * name a person) is shown, but never the body: details stay in the app.
 */
export function lockScreenPreview(
  notification: Pick<ComposedNotification, 'category' | 'title'>,
  preferences: Pick<NotificationPreferences, 'showNamesOnLockScreen'>,
): LockScreenPreview {
  return preferences.showNamesOnLockScreen
    ? { title: notification.title, body: 'Open CabinGuard for details.' }
    : { title: 'CabinGuard', body: GENERIC_BODY[notification.category] };
}
