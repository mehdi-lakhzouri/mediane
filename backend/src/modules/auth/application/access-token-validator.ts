import { Injectable } from '@nestjs/common';
import { SessionsService } from '../../sessions/application/sessions.service';
import { canAuthenticate } from '../../users/domain/account-state';
import { UserRepository } from '../../users/domain/user.repository';
import type { AccessTokenPayload } from '../domain/access-token-payload';
import type { AuthenticatedUser } from '../domain/authenticated-user';
import { SessionInvalidError } from '../domain/auth.errors';

/**
 * Runs on every authenticated request, after the JWT signature/expiry check.
 * The extra lookups make revocation immediate (logout, logout-all, suspension,
 * deletion) instead of waiting for the access token to expire.
 * If this becomes a hot path, add a short-lived cache here, not in the guards.
 */
@Injectable()
export class AccessTokenValidator {
  constructor(
    private readonly sessions: SessionsService,
    private readonly users: UserRepository,
  ) {}

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const [session, user] = await Promise.all([
      this.sessions.findActiveSession(payload.sid),
      this.users.findById(payload.sub),
    ]);
    if (!session || !user || session.userId !== user.id) {
      throw new SessionInvalidError();
    }
    const accountState = user.accountState;
    if (!canAuthenticate(accountState)) throw new SessionInvalidError();

    return {
      userId: user.id,
      sessionId: session.id,
      role: user.role,
      accountState,
    };
  }
}
