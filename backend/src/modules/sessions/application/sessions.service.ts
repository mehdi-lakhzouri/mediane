import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { authConfig, type AuthConfig } from '../../../config';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action';
import { SecureTokenService } from '../../security/infrastructure/secure-token.service';
import {
  RefreshSession,
  SessionChannel,
  SessionRevocationReason,
} from '../domain/refresh-session';
import {
  describeUserAgent,
  type DeviceDescription,
} from '../domain/device-description';
import { RefreshSessionRepository } from '../domain/refresh-session.repository';
import {
  CurrentSessionRevocationError,
  InvalidRefreshTokenError,
  SessionNotFoundError,
} from '../domain/session.errors';

/** One signed-in device, for its owner. */
export interface ActiveSessionView {
  id: string;
  channel: SessionChannel;
  device: DeviceDescription;
  ipAddress: string | null;
  signedInAt: Date;
  lastActiveAt: Date;
  current: boolean;
}

export interface OpenedSession {
  session: RefreshSession;
  /**
   * Raw refresh token: goes to the HttpOnly cookie (web) or the response body
   * (mobile, kept in the device keystore). Never stored or logged.
   */
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/**
 * Two tabs sharing the same cookie may refresh at the same instant: the loser
 * presents the just-rotated token. Within this window that is treated as a race
 * (request rejected, session kept); after it, as a replay (session revoked).
 * Either way the stale token never grants anything.
 */
export const ROTATION_GRACE_MS = 10_000;

/**
 * Session lifecycle. Security model:
 *  - refresh token = 256-bit random value, stored as an HMAC hash only;
 *  - rotation on every refresh (atomic compare-and-swap on the current hash);
 *  - the previous hash is kept: presenting it again outside the grace window
 *    means the token was copied -> the session is revoked and audited;
 *  - a brand-new session (new id + token) is opened on every login (no fixation).
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly sessions: RefreshSessionRepository,
    private readonly tokens: SecureTokenService,
    private readonly audit: AuditService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfig,
  ) {}

  async findActiveSession(
    sessionId: string,
    now = new Date(),
  ): Promise<RefreshSession | null> {
    const session = await this.sessions.findById(sessionId);
    return session?.isActive(now) ? session : null;
  }

  private idleTtlSeconds(channel: SessionChannel): number {
    return channel === SessionChannel.WEB
      ? this.auth.refreshSession.webIdleTtlSeconds
      : this.auth.refreshSession.idleTtlSeconds;
  }

  async open(
    userId: string,
    client: ClientContext,
    options: { persistent: boolean; channel: SessionChannel },
    now = new Date(),
  ): Promise<OpenedSession> {
    const refreshToken = this.tokens.generateToken();
    const { expiresAt, absoluteExpiresAt } = RefreshSession.initialExpiries(
      now,
      {
        idleSeconds: this.idleTtlSeconds(options.channel),
        absoluteSeconds: this.auth.refreshSession.absoluteTtlSeconds,
      },
    );
    const session = await this.sessions.create({
      userId,
      tokenHash: this.tokens.hashToken(refreshToken),
      expiresAt,
      absoluteExpiresAt,
      persistent: options.persistent,
      channel: options.channel,
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
    });
    return { session, refreshToken, refreshTokenExpiresAt: expiresAt };
  }

  /**
   * A token presented on the wrong channel (a mobile token sent as a web cookie,
   * or the reverse) is refused without touching the session.
   * @throws InvalidRefreshTokenError for every failure mode (no oracle).
   */
  async rotate(
    rawRefreshToken: string | undefined,
    channel: SessionChannel,
    client: ClientContext,
    now = new Date(),
  ): Promise<OpenedSession> {
    if (!rawRefreshToken) throw new InvalidRefreshTokenError();
    const presentedHash = this.tokens.hashToken(rawRefreshToken);

    const session = await this.sessions.findByTokenHash(presentedHash);
    if (!session) {
      await this.handlePossibleReuse(presentedHash, client, now);
      throw new InvalidRefreshTokenError();
    }
    if (!session.isActive(now) || session.channel !== channel) {
      throw new InvalidRefreshTokenError();
    }

    const refreshToken = this.tokens.generateToken();
    const expiresAt = session.nextExpiry(now, this.idleTtlSeconds(channel));
    const rotated = await this.sessions.rotate({
      sessionId: session.id,
      currentTokenHash: presentedHash,
      newTokenHash: this.tokens.hashToken(refreshToken),
      expiresAt,
      now,
    });
    // Lost a race against a concurrent rotation or a revocation.
    if (!rotated) throw new InvalidRefreshTokenError();

    return { session: rotated, refreshToken, refreshTokenExpiresAt: expiresAt };
  }

  /**
   * Records meaningful client activity without rotating the refresh token.
   * The conditional repository update prevents an expired or revoked session
   * from being revived by a request racing with its deadline.
   */
  async touch(
    sessionId: string,
    channel: SessionChannel,
    now = new Date(),
  ): Promise<Date | null> {
    const session = await this.sessions.findById(sessionId);
    if (!session?.isActive(now) || session.channel !== channel) return null;
    const expiresAt = session.nextExpiry(now, this.idleTtlSeconds(channel));
    const touched = await this.sessions.touch({ sessionId, expiresAt, now });
    return touched ? expiresAt : null;
  }

  /** Logout of one device. Returns the revoked session, or null if nothing to revoke. */
  async revokeByRefreshToken(
    rawRefreshToken: string | undefined,
    channel: SessionChannel,
    reason: SessionRevocationReason,
    now = new Date(),
  ): Promise<RefreshSession | null> {
    if (!rawRefreshToken) return null;
    const session = await this.sessions.findByTokenHash(
      this.tokens.hashToken(rawRefreshToken),
    );
    if (!session || session.channel !== channel) return null;
    const revoked = await this.sessions.revoke(session.id, reason, now);
    return revoked ? session : null;
  }

  revoke(
    sessionId: string,
    reason: SessionRevocationReason,
    now = new Date(),
  ): Promise<boolean> {
    return this.sessions.revoke(sessionId, reason, now);
  }

  revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
    now = new Date(),
  ): Promise<number> {
    return this.sessions.revokeAllForUser(userId, reason, now);
  }

  async listActive(
    userId: string,
    currentSessionId: string,
    now = new Date(),
  ): Promise<ActiveSessionView[]> {
    const sessions = await this.sessions.listActiveForUser(userId, now);
    return sessions.map((session) => ({
      id: session.id,
      channel: session.channel,
      device: describeUserAgent(session.userAgent),
      ipAddress: session.ipAddress,
      signedInAt: session.createdAt,
      lastActiveAt: session.lastUsedAt ?? session.createdAt,
      current: session.id === currentSessionId,
    }));
  }

  /** Signed-in devices other than [excludingSessionId]. */
  async countOtherActive(
    userId: string,
    excludingSessionId: string,
    now = new Date(),
  ): Promise<number> {
    const sessions = await this.sessions.listActiveForUser(userId, now);
    return sessions.filter((s) => s.id !== excludingSessionId).length;
  }

  /** Signs one of the user's other devices out. */
  async revokeOwn(
    userId: string,
    sessionId: string,
    currentSessionId: string,
    client: ClientContext,
    now = new Date(),
  ): Promise<void> {
    if (sessionId === currentSessionId) {
      throw new CurrentSessionRevocationError();
    }
    const session = await this.sessions.findById(sessionId);
    if (!session || session.userId !== userId || !session.isActive(now)) {
      throw new SessionNotFoundError();
    }
    await this.sessions.revoke(sessionId, SessionRevocationReason.LOGOUT, now);
    await this.audit.record({
      action: AuditAction.SESSION_REVOKED,
      actor: { type: 'USER', userId },
      target: { type: 'SESSION', id: sessionId },
      client,
      metadata: { reason: 'REVOKED_FROM_ANOTHER_DEVICE' },
    });
  }

  /** "Sign out everywhere else": keeps only the current device. */
  async revokeOthers(
    userId: string,
    currentSessionId: string,
    client: ClientContext,
    now = new Date(),
  ): Promise<number> {
    const count = await this.sessions.revokeAllForUserExcept(
      userId,
      currentSessionId,
      SessionRevocationReason.LOGOUT_ALL,
      now,
    );
    await this.audit.record({
      action: AuditAction.ALL_SESSIONS_REVOKED,
      actor: { type: 'USER', userId },
      target: { type: 'USER', id: userId },
      client,
      metadata: { revokedSessions: count, keptCurrent: true },
    });
    return count;
  }

  /**
   * Must NOT run inside a UnitOfWork: the caller throws right after, and the
   * revocation has to survive that error.
   */
  private async handlePossibleReuse(
    presentedHash: string,
    client: ClientContext,
    now: Date,
  ): Promise<void> {
    const session = await this.sessions.findByPreviousTokenHash(presentedHash);
    if (!session || session.revokedAt) return;
    if (session.wasRotatedWithin(ROTATION_GRACE_MS, now)) return;

    await this.sessions.revoke(
      session.id,
      SessionRevocationReason.TOKEN_REUSE_DETECTED,
      now,
    );
    this.logger.warn(
      { sessionId: session.id, requestId: client.requestId },
      'Refresh token reuse detected: session revoked',
    );
    await this.audit.record({
      action: AuditAction.REFRESH_TOKEN_REUSE_DETECTED,
      outcome: 'FAILURE',
      actor: { type: 'SYSTEM' },
      target: { type: 'SESSION', id: session.id },
      client,
      metadata: { userId: session.userId },
    });
  }
}
