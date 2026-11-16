import { Role } from './role';
import { UserStatus } from './user-status';

/**
 * Effective account state, DERIVED from independent stored facts instead of being
 * stored as one enum. This makes impossible combinations unrepresentable, e.g.:
 *   - suspending then reactivating a user keeps its onboarding progress,
 *   - restoring a soft-deleted user brings back its previous status,
 *   - "logged in with a temporary password" is simply mustChangePassword = true
 *     (the requested ACTIVE_TEMP_PASSWORD and PASSWORD_CHANGE_REQUIRED are the same state).
 */
export const AccountState = {
  INVITED: 'INVITED',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  MFA_SETUP_REQUIRED: 'MFA_SETUP_REQUIRED',
  PROFILE_SETUP_REQUIRED: 'PROFILE_SETUP_REQUIRED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
} as const;
export type AccountState = (typeof AccountState)[keyof typeof AccountState];

export interface AccountStateFacts {
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  mfaEnabledAt: Date | null;
  profileCompletedAt: Date | null;
  deletedAt: Date | null;
}

/**
 * Roles that cannot use the product without a second factor. Others may
 * enable it voluntarily. Empty: every role, administrators included, chooses
 * whether to use an authenticator from its security settings.
 */
export const MFA_REQUIRED_ROLES: readonly Role[] = [];

export function isMfaRequired(role: Role): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}

/**
 * Precedence matters: deletion > suspension > invitation > onboarding steps
 * (own password first, then the authenticator, then the driver profile).
 */
export function deriveAccountState(facts: AccountStateFacts): AccountState {
  if (facts.deletedAt) return AccountState.DELETED;
  if (facts.status === UserStatus.SUSPENDED) return AccountState.SUSPENDED;
  if (facts.status === UserStatus.INVITED) return AccountState.INVITED;
  if (facts.mustChangePassword) return AccountState.PASSWORD_CHANGE_REQUIRED;
  if (isMfaRequired(facts.role) && !facts.mfaEnabledAt) {
    return AccountState.MFA_SETUP_REQUIRED;
  }
  if (facts.role === Role.DRIVER && !facts.profileCompletedAt) {
    return AccountState.PROFILE_SETUP_REQUIRED;
  }
  return AccountState.ACTIVE;
}

/** States allowed to hold a session. Everything else is rejected at token validation. */
export const AUTHENTICABLE_ACCOUNT_STATES: readonly AccountState[] = [
  AccountState.PASSWORD_CHANGE_REQUIRED,
  AccountState.MFA_SETUP_REQUIRED,
  AccountState.PROFILE_SETUP_REQUIRED,
  AccountState.ACTIVE,
];

export function canAuthenticate(state: AccountState): boolean {
  return AUTHENTICABLE_ACCOUNT_STATES.includes(state);
}
