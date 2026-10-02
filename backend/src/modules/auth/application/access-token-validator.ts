import { Injectable } from '@nestjs/common';
import { SessionsService } from '../../sessions/application/sessions.service';
import { SessionChannel } from '../../sessions/domain/refresh-session';
import { canAuthenticate } from '../../users/domain/account-state';
import { UserRepository } from '../../users/domain/user.repository';
import type { AccessTokenPayload } from '../domain/access-token-payload';
import type { AuthenticatedUser } from '../domain/authenticated-user';
import { SessionInvalidError } from '../domain/auth.errors';
import { channelForRole } from '../domain/channel-policy';

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

  /** @param channel how the token reached us (cookie => WEB, Bearer => MOBILE). */
  async validate(
    payload: AccessTokenPayload,
    channel: SessionChannel,
  ): Promise<AuthenticatedUser> {
    const [session, user] = await Promise.all([
      this.sessions.findActiveSession(payload.sid),
      this.users.findById(payload.sub),
    ]);
    if (
      !session ||
      !user ||
      session.userId !== user.id ||
      session.channel !== channel ||
      channelForRole(user.role) !== channel
    ) {
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
