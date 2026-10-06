import {
  AuditAction,
  type AuditAction as AuditActionValue,
} from './audit-action';

export const AuditCategory = {
  ACCOUNT: 'ACCOUNT',
  ACCESS: 'ACCESS',
  SECURITY: 'SECURITY',
  FAMILY: 'FAMILY',
  DEVICE: 'DEVICE',
  SAFETY: 'SAFETY',
  SYSTEM: 'SYSTEM',
} as const;
export type AuditCategory = (typeof AuditCategory)[keyof typeof AuditCategory];

export const AUDIT_ACTIONS_BY_CATEGORY: Record<
  AuditCategory,
  readonly AuditActionValue[]
> = {
  ACCOUNT: [
    AuditAction.USER_CREATED,
    AuditAction.USER_UPDATED,
    AuditAction.USER_SOFT_DELETED,
    AuditAction.USER_RESTORED,
    AuditAction.USER_HARD_DELETED,
    AuditAction.USER_SUSPENDED,
    AuditAction.USER_REACTIVATED,
    AuditAction.PROFILE_COMPLETED,
    AuditAction.PROFILE_UPDATED,
    AuditAction.PROFILE_AVATAR_UPDATED,
    AuditAction.PROFILE_AVATAR_REMOVED,
  ],
  ACCESS: [
    AuditAction.INVITATION_SENT,
    AuditAction.INVITATION_RESENT,
    AuditAction.INVITATION_REVOKED,
    AuditAction.INVITATION_ACCEPTED,
  ],
  SECURITY: [
    AuditAction.LOGIN_SUCCEEDED,
    AuditAction.LOGIN_FAILED,
    AuditAction.PASSWORD_CHANGED,
    AuditAction.PASSWORD_RESET_REQUESTED,
    AuditAction.PASSWORD_RESET_COMPLETED,
    AuditAction.SESSION_REVOKED,
    AuditAction.ALL_SESSIONS_REVOKED,
    AuditAction.REFRESH_TOKEN_REUSE_DETECTED,
    AuditAction.MFA_ENABLED,
    AuditAction.MFA_AUTHENTICATOR_REPLACED,
    AuditAction.MFA_DISABLED,
    AuditAction.MFA_RESET_BY_ADMIN,
    AuditAction.MFA_RECOVERY_CODES_REGENERATED,
    AuditAction.MFA_RECOVERY_CODE_USED,
    AuditAction.MFA_VERIFICATION_FAILED,
    AuditAction.MFA_CHALLENGE_ISSUED,
  ],
  FAMILY: [
    AuditAction.FAMILY_CREATED,
    AuditAction.FAMILY_RENAMED,
    AuditAction.FAMILY_DISSOLVED,
    AuditAction.FAMILY_INVITE_ROTATED,
    AuditAction.FAMILY_JOIN_REQUESTED,
    AuditAction.FAMILY_JOIN_APPROVED,
    AuditAction.FAMILY_JOIN_REJECTED,
    AuditAction.FAMILY_JOIN_CANCELLED,
    AuditAction.FAMILY_MEMBER_ADDED,
    AuditAction.FAMILY_MEMBER_REMOVED,
    AuditAction.FAMILY_MEMBER_LEFT,
    AuditAction.FAMILY_OWNERSHIP_TRANSFERRED,
    AuditAction.FAMILY_SHARING_UPDATED,
  ],
  DEVICE: [
    AuditAction.DEVICE_REGISTERED,
    AuditAction.DEVICE_PAIRED,
    AuditAction.DEVICE_UNPAIRED,
    AuditAction.DEVICE_REVOKED,
    AuditAction.DEVICE_SECRET_ROTATED,
  ],
  SAFETY: [
    AuditAction.INCIDENT_OPENED,
    AuditAction.INCIDENT_ACKNOWLEDGED,
    AuditAction.INCIDENT_ESCALATED,
    AuditAction.INCIDENT_RESOLVED,
    AuditAction.SOS_TRIGGERED,
    AuditAction.ANNOUNCEMENT_SENT,
  ],
  SYSTEM: [AuditAction.ADMIN_BOOTSTRAPPED],
};

export function categoryForAuditAction(
  action: AuditActionValue,
): AuditCategory {
  for (const [category, actions] of Object.entries(
    AUDIT_ACTIONS_BY_CATEGORY,
  ) as Array<[AuditCategory, readonly AuditActionValue[]]>) {
    if (actions.includes(action)) return category;
  }
  return AuditCategory.SYSTEM;
}
