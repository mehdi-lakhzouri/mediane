import { AccountState } from '../../users/domain/account-state';
import { Role } from '../../users/domain/role';

/**
 * The principal attached to the request after access-token validation.
 * role and accountState come from the DATABASE (not from the token), so a role
 * change, suspension or completed onboarding is effective on the next request.
 */
export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  role: Role;
  accountState: AccountState;
}

export function isAuthenticatedUser(
  value: unknown,
): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.userId === 'string' &&
    typeof candidate.sessionId === 'string' &&
    Object.values<unknown>(Role).includes(candidate.role) &&
    Object.values<unknown>(AccountState).includes(candidate.accountState)
  );
}
