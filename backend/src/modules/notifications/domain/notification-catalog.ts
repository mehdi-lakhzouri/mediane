import {
  type ComposedNotification,
  NotificationCategory,
} from './notification';

/**
 * Every notification the product sends, with the facts it needs. Callers
 * describe what happened; the catalog owns the wording, so copy stays
 * consistent and medical details can never slip in (no message carries a
 * diagnosis, an event type or a reading).
 */
export type NotificationMessage =
  // Safety
  | { type: 'FAMILY_MEMBER_NEEDS_HELP'; memberName: string }
  | { type: 'FAMILY_MEMBER_SAFE'; memberName: string }
  | { type: 'OWN_ALERT_ESCALATED'; incidentId: string }
  | { type: 'OWN_ALERT_AUTO_CLOSED'; incidentId: string }
  | { type: 'CABIN_UNIT_OFFLINE' }
  // Family
  | { type: 'FAMILY_JOIN_REQUESTED'; requesterName: string }
  | { type: 'FAMILY_JOIN_APPROVED'; familyName: string }
  | { type: 'FAMILY_JOIN_REJECTED'; familyName: string }
  | { type: 'FAMILY_MEMBER_JOINED'; memberName: string; familyName: string }
  | { type: 'FAMILY_MEMBER_LEFT'; memberName: string; familyName: string }
  | { type: 'FAMILY_MEMBER_REMOVED'; familyName: string }
  | { type: 'FAMILY_OWNERSHIP_RECEIVED'; familyName: string }
  | { type: 'FAMILY_ADDED'; familyName: string }
  | { type: 'FAMILY_DISSOLVED'; familyName: string }
  // Security
  | { type: 'NEW_SIGN_IN'; deviceLabel: string }
  | { type: 'PASSWORD_CHANGED' }
  | { type: 'TWO_STEP_ENABLED' }
  | { type: 'TWO_STEP_DISABLED' }
  | { type: 'RECOVERY_CODES_LOW'; remaining: number }
  // Account
  | { type: 'ANNOUNCEMENT'; title: string; body: string };

export type NotificationType = NotificationMessage['type'];

export function composeNotification(
  message: NotificationMessage,
): ComposedNotification {
  const safety = NotificationCategory.SAFETY;
  const family = NotificationCategory.FAMILY;
  const security = NotificationCategory.SECURITY;
  const base = { type: message.type, critical: false };

  switch (message.type) {
    case 'FAMILY_MEMBER_NEEDS_HELP':
      return {
        ...base,
        category: safety,
        critical: true,
        title: `${message.memberName} may need help`,
        body: `Mediane alerted ${message.memberName}'s emergency contacts. Try to reach them now.`,
        link: '/family',
      };
    case 'FAMILY_MEMBER_SAFE':
      return {
        ...base,
        category: safety,
        title: `${message.memberName} is safe`,
        body: `${message.memberName} said they are OK. The alert is over.`,
        link: '/family',
      };
    case 'OWN_ALERT_ESCALATED':
      return {
        ...base,
        category: safety,
        title: 'Help was called',
        body: 'Your emergency contacts were alerted. Tell them you are OK if you are safe.',
        link: `/incidents/${message.incidentId}`,
      };
    case 'OWN_ALERT_AUTO_CLOSED':
      return {
        ...base,
        category: safety,
        title: 'Alert closed',
        body: 'Your alert was closed automatically after 24 hours.',
        link: `/incidents/${message.incidentId}`,
      };
    case 'CABIN_UNIT_OFFLINE':
      return {
        ...base,
        category: safety,
        title: 'Cabin unit offline',
        body: 'Your cabin unit stopped reporting. Check that it has power and a connection.',
        link: '/home',
      };
    case 'FAMILY_JOIN_REQUESTED':
      return {
        ...base,
        category: family,
        title: 'New join request',
        body: `${message.requesterName} asked to join your family.`,
        link: '/family/requests',
      };
    case 'FAMILY_JOIN_APPROVED':
      return {
        ...base,
        category: family,
        title: 'Request approved',
        body: `You are now a member of ${message.familyName}.`,
        link: '/family',
      };
    case 'FAMILY_JOIN_REJECTED':
      return {
        ...base,
        category: family,
        title: 'Request declined',
        body: `Your request to join ${message.familyName} was declined.`,
        link: '/family',
      };
    case 'FAMILY_MEMBER_JOINED':
      return {
        ...base,
        category: family,
        title: 'New family member',
        body: `${message.memberName} joined ${message.familyName}.`,
        link: '/family',
      };
    case 'FAMILY_MEMBER_LEFT':
      return {
        ...base,
        category: family,
        title: 'A member left',
        body: `${message.memberName} left ${message.familyName}.`,
        link: '/family',
      };
    case 'FAMILY_MEMBER_REMOVED':
      return {
        ...base,
        category: family,
        title: 'Removed from family',
        body: `You are no longer a member of ${message.familyName}.`,
        link: '/family',
      };
    case 'FAMILY_OWNERSHIP_RECEIVED':
      return {
        ...base,
        category: family,
        title: 'You are now the owner',
        body: `You now manage ${message.familyName}: invitations and join requests.`,
        link: '/family',
      };
    case 'FAMILY_ADDED':
      return {
        ...base,
        category: family,
        title: 'Added to a family',
        body: `You are now a member of ${message.familyName}.`,
        link: '/family',
      };
    case 'FAMILY_DISSOLVED':
      return {
        ...base,
        category: family,
        title: 'Family dissolved',
        body: `${message.familyName} no longer exists. You can create or join another family.`,
        link: '/family',
      };
    case 'NEW_SIGN_IN':
      return {
        ...base,
        category: security,
        title: 'New sign-in',
        body: `Your account was used to sign in on ${message.deviceLabel}. If this was not you, sign that device out and change your password.`,
        link: '/security/devices',
      };
    case 'PASSWORD_CHANGED':
      return {
        ...base,
        category: security,
        title: 'Password changed',
        body: 'Your password was changed and your other devices were signed out.',
        link: '/security',
      };
    case 'TWO_STEP_ENABLED':
      return {
        ...base,
        category: security,
        title: 'Two-step verification on',
        body: 'Signing in now needs a code from your authenticator app.',
        link: '/security',
      };
    case 'TWO_STEP_DISABLED':
      return {
        ...base,
        category: security,
        title: 'Two-step verification off',
        body: 'Your account is protected by your password only. Turn it back on in Security.',
        link: '/security',
      };
    case 'RECOVERY_CODES_LOW':
      return {
        ...base,
        category: security,
        title: 'Recovery codes running low',
        body: `${message.remaining} recovery ${message.remaining === 1 ? 'code is' : 'codes are'} left. Create new ones in Security.`,
        link: '/security',
      };
    case 'ANNOUNCEMENT':
      return {
        ...base,
        category: NotificationCategory.ACCOUNT,
        title: message.title,
        body: message.body,
        link: null,
      };
  }
}
