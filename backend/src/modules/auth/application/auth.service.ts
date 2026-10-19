import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { Email } from '../../../common/domain/email';
import {
  appConfig,
  authConfig,
  mfaConfig,
  type AppConfig,
  type AuthConfig,
  type MfaConfig,
} from '../../../config';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action';
import { MailSender } from '../../mail/application/mail-sender';
import { MfaMethod, MfaVerifier } from '../../mfa/application/mfa-verifier';
import { NotificationsService } from '../../notifications/application/notifications.service';
import {
  MfaChallengeInvalidError,
  MfaCodeRequiredError,
} from '../../mfa/domain/mfa.errors';
import { PasswordHasher } from '../../security/application/password-hasher';
import { assertPasswordPolicy } from '../../security/domain/password-policy';
import { SecureTokenService } from '../../security/infrastructure/secure-token.service';
import { describeUserAgent } from '../../sessions/domain/device-description';
import {
  OpenedSession,
  SessionsService,
} from '../../sessions/application/sessions.service';
import {
  SessionChannel,
  SessionRevocationReason,
} from '../../sessions/domain/refresh-session';
import {
  AccountState,
  canAuthenticate,
} from '../../users/domain/account-state';
import { User } from '../../users/domain/user';
import { UserRepository } from '../../users/domain/user.repository';
import {
  InvalidCredentialsError,
  InvalidCurrentPasswordError,
  InvalidPasswordResetTokenError,
  PasswordUnchangedError,
  SessionInvalidError,
  TemporaryPasswordExpiredError,
} from '../domain/auth.errors';
import type { AuthenticatedUser } from '../domain/authenticated-user';
import { channelForRole, WrongClientError } from '../domain/channel-policy';
import { LoginPolicy, PasswordResetPolicy } from '../domain/login-policy';
import { MfaChallengeRepository } from '../domain/mfa-challenge.repository';
import {
  type PasswordResetTokenRecord,
  PasswordResetTokenRepository,
} from '../domain/password-reset-token.repository';
import { AccessTokenIssuer } from '../infrastructure/access-token.issuer';

export interface LoginCommand {
  email: string;
  password: string;
  rememberMe: boolean;
  /** The client the request came through (web console or mobile app). */
  channel: SessionChannel;
  client: ClientContext;
}

export interface ChangePasswordCommand {
  currentPassword: string;
  newPassword: string;
  /** Required when the user has MFA enabled (TOTP or recovery code). */
  mfaCode?: string;
  client: ClientContext;
}

/** Password verified; the second factor is still needed. */
export interface MfaChallengeIssued {
  /** Raw token: returned to the client once, only its hash is stored. */
  mfaToken: string;
  expiresAt: Date;
}

export type LoginResult =
  | { kind: 'SESSION'; tokens: IssuedTokens }
  | { kind: 'MFA_REQUIRED'; challenge: MfaChallengeIssued };

/** The authenticated caller's own identity (account menu, profile screens). */
export interface CurrentUserView {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AuthenticatedUser['role'];
  accountState: AuthenticatedUser['accountState'];
  sessionPolicy: {
    idleTimeoutSeconds: number;
    warningSeconds: number;
    countdownSeconds: number;
    activityHeartbeatSeconds: number;
  };
}

export interface SessionActivityView {
  expiresAt: Date;
}

/**
 * Tokens produced by login/refresh. The web adapter turns them into cookies,
 * the mobile adapter returns them in the response body.
 */
export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  /** false => browser-session cookies ("Keep me signed in" unchecked). */
  persistent: boolean;
  principal: AuthenticatedUser;
}

type LoginFailureReason =
  | 'UNKNOWN_ACCOUNT'
  | 'ACCOUNT_LOCKED'
  | 'INVALID_PASSWORD'
  | 'ACCOUNT_NOT_AUTHENTICABLE'
  | 'WRONG_CLIENT'
  | 'TEMPORARY_PASSWORD_EXPIRED'
  | 'MFA_CHALLENGE_ACCOUNT_STATE';

function revocationReasonFor(
  state: AccountState | null,
): SessionRevocationReason {
  if (state === AccountState.SUSPENDED) {
    return SessionRevocationReason.USER_SUSPENDED;
  }
  if (state === null || state === AccountState.DELETED) {
    return SessionRevocationReason.USER_DELETED;
  }
  return SessionRevocationReason.ADMIN_REVOKED;
}

/**
 * Authentication use cases.
 *  - No account enumeration: unknown email, wrong password, locked, invited and
 *    suspended accounts all yield INVALID_CREDENTIALS, and unknown emails still
 *    pay for an Argon2 verification (constant-ish timing).
 *  - A new session (new id + tokens) on every login and password change: no fixation.
 *  - Password change/reset revokes every session and every pending reset token.
 *  - Every session is bound to one channel (web cookies or mobile Bearer tokens),
 *    and each role may only use its own channel (see channel-policy.ts).
 *  - With MFA enabled, a correct password only yields a short-lived challenge;
 *    the session is opened once a TOTP or recovery code is verified.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionsService,
    private readonly accessTokens: AccessTokenIssuer,
    private readonly tokens: SecureTokenService,
    private readonly resetTokens: PasswordResetTokenRepository,
    private readonly mail: MailSender,
    private readonly audit: AuditService,
    private readonly unitOfWork: UnitOfWork,
    private readonly mfaChallenges: MfaChallengeRepository,
    private readonly mfaVerifier: MfaVerifier,
    private readonly notifications: NotificationsService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfig,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
    @Inject(mfaConfig.KEY) private readonly mfa: MfaConfig,
  ) {}

  async login(command: LoginCommand): Promise<LoginResult> {
    const { client } = command;
    const now = new Date();
    const user = await this.findUserByEmail(command.email);

    if (!user) {
      await this.burnPasswordVerification(command.password);
      await this.auditLoginFailure(null, 'UNKNOWN_ACCOUNT', client);
      throw new InvalidCredentialsError();
    }
    if (user.isLocked(now)) {
      await this.burnPasswordVerification(command.password);
      await this.auditLoginFailure(user.id, 'ACCOUNT_LOCKED', client);
      throw new InvalidCredentialsError();
    }
    if (!(await this.hasher.verify(user.passwordHash, command.password))) {
      await this.registerFailedAttempt(user.id, now);
      await this.auditLoginFailure(user.id, 'INVALID_PASSWORD', client);
      throw new InvalidCredentialsError();
    }

    // Password is correct from here on: state-specific answers leak nothing new.
    const accountState = user.accountState;
    if (!canAuthenticate(accountState)) {
      await this.auditLoginFailure(
        user.id,
        'ACCOUNT_NOT_AUTHENTICABLE',
        client,
      );
      throw new InvalidCredentialsError();
    }
    const expectedChannel = channelForRole(user.role);
    if (command.channel !== expectedChannel) {
      await this.auditLoginFailure(user.id, 'WRONG_CLIENT', client);
      throw new WrongClientError(expectedChannel);
    }
    if (user.isTemporaryPasswordExpired(now)) {
      await this.auditLoginFailure(
        user.id,
        'TEMPORARY_PASSWORD_EXPIRED',
        client,
      );
      throw new TemporaryPasswordExpiredError();
    }

    // Transparent upgrade when Argon2 parameters were strengthened.
    const upgradedHash = this.hasher.needsRehash(user.passwordHash)
      ? await this.hasher.hash(command.password)
      : null;

    if (user.hasMfa) {
      // The failure counter is NOT reset yet: wrong codes keep counting
      // towards the lock until the second factor succeeds.
      if (upgradedHash) {
        await this.users.replacePasswordHash(user.id, upgradedHash);
      }
      return {
        kind: 'MFA_REQUIRED',
        challenge: await this.issueMfaChallenge(user, command, now),
      };
    }

    const tokens = await this.openLoginSession(
      user,
      { persistent: command.rememberMe, channel: command.channel },
      { upgradedHash, mfaMethod: null },
      client,
      now,
    );
    return { kind: 'SESSION', tokens };
  }

  /**
   * Second login step. The challenge is single-use, short-lived, bound to its
   * channel and limited in attempts; wrong codes also count towards the
   * per-account lock (see MfaVerifier).
   */
  async completeMfaChallenge(
    rawToken: string,
    code: string,
    channel: SessionChannel,
    client: ClientContext,
  ): Promise<IssuedTokens> {
    const now = new Date();
    const challenge = await this.mfaChallenges.findByTokenHash(
      this.tokens.hashToken(rawToken),
    );
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= now ||
      challenge.channel !== channel ||
      challenge.failedAttempts >= this.mfa.challengeMaxAttempts
    ) {
      throw new MfaChallengeInvalidError();
    }
    const user = await this.users.findById(challenge.userId);
    if (
      !user ||
      !user.hasMfa ||
      user.isLocked(now) ||
      !canAuthenticate(user.accountState) ||
      channelForRole(user.role) !== channel
    ) {
      if (user) {
        await this.auditLoginFailure(
          user.id,
          'MFA_CHALLENGE_ACCOUNT_STATE',
          client,
        );
      }
      throw new MfaChallengeInvalidError();
    }

    let mfaMethod: MfaMethod;
    try {
      mfaMethod = await this.mfaVerifier.verify(
        user.id,
        code,
        'LOGIN',
        client,
        now,
      );
    } catch (error) {
      await this.mfaChallenges.recordFailure(challenge.id);
      throw error;
    }

    return this.openLoginSession(
      user,
      { persistent: challenge.persistent, channel },
      { upgradedHash: null, mfaMethod, challengeId: challenge.id },
      client,
      now,
    );
  }

  async refresh(
    rawRefreshToken: string | undefined,
    channel: SessionChannel,
    client: ClientContext,
  ): Promise<IssuedTokens> {
    const now = new Date();
    const opened = await this.sessions.rotate(
      rawRefreshToken,
      channel,
      client,
      now,
    );
    const user = await this.users.findById(opened.session.userId);
    const accountState = user?.accountState ?? null;

    if (
      !user ||
      !accountState ||
      !canAuthenticate(accountState) ||
      channelForRole(user.role) !== channel
    ) {
      await this.sessions.revoke(
        opened.session.id,
        revocationReasonFor(accountState),
        now,
      );
      throw new SessionInvalidError();
    }
    return this.issueTokens(user, opened, now);
  }

  /**
   * Driven by the refresh token (not the access token) so that logout still
   * works after the access token expired. Revokes only this device's session.
   */
  async logout(
    rawRefreshToken: string | undefined,
    channel: SessionChannel,
    client: ClientContext,
  ): Promise<void> {
    const session = await this.sessions.revokeByRefreshToken(
      rawRefreshToken,
      channel,
      SessionRevocationReason.LOGOUT,
    );
    if (!session) return;
    await this.audit.record({
      action: AuditAction.SESSION_REVOKED,
      actor: { type: 'USER', userId: session.userId },
      target: { type: 'SESSION', id: session.id },
      client,
      metadata: { reason: SessionRevocationReason.LOGOUT },
    });
  }

  /**
   * The caller's own identity, for the account menu. Kept off the request
   * principal on purpose: that object is attached to every request, and names
   * and emails have no business travelling through the guard chain or logs.
   */
  async getCurrentUser(principal: AuthenticatedUser): Promise<CurrentUserView> {
    const user = await this.users.findById(principal.userId);
    if (!user) throw new SessionInvalidError();
    return {
      userId: user.id,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      accountState: user.accountState,
      sessionPolicy: this.auth.webSession,
    };
  }

  async recordWebActivity(
    principal: AuthenticatedUser,
  ): Promise<SessionActivityView> {
    const expiresAt = await this.sessions.touch(
      principal.sessionId,
      SessionChannel.WEB,
    );
    if (!expiresAt) throw new SessionInvalidError();
    return { expiresAt };
  }

  async logoutAllDevices(
    principal: AuthenticatedUser,
    client: ClientContext,
  ): Promise<void> {
    const count = await this.sessions.revokeAllForUser(
      principal.userId,
      SessionRevocationReason.LOGOUT_ALL,
    );
    await this.audit.record({
      action: AuditAction.ALL_SESSIONS_REVOKED,
      actor: { type: 'USER', userId: principal.userId },
      target: { type: 'USER', id: principal.userId },
      client,
      metadata: { revokedSessions: count },
    });
  }

  async changePassword(
    principal: AuthenticatedUser,
    command: ChangePasswordCommand,
  ): Promise<IssuedTokens> {
    const { client } = command;
    const now = new Date();
    const user = await this.users.findById(principal.userId);
    if (!user) throw new SessionInvalidError();

    if (
      !(await this.hasher.verify(user.passwordHash, command.currentPassword))
    ) {
      await this.audit.record({
        action: AuditAction.PASSWORD_CHANGED,
        outcome: 'FAILURE',
        actor: { type: 'USER', userId: user.id },
        target: { type: 'USER', id: user.id },
        client,
        metadata: { reason: 'INVALID_CURRENT_PASSWORD' },
      });
      throw new InvalidCurrentPasswordError();
    }
    if (command.newPassword === command.currentPassword) {
      throw new PasswordUnchangedError();
    }
    assertPasswordPolicy(command.newPassword, { email: user.email.value });
    if (user.hasMfa) {
      if (!command.mfaCode) throw new MfaCodeRequiredError();
      await this.mfaVerifier.verify(
        user.id,
        command.mfaCode,
        'PASSWORD_CHANGE',
        client,
        now,
      );
    }

    const newHash = await this.hasher.hash(command.newPassword);
    const currentSession = await this.sessions.findActiveSession(
      principal.sessionId,
      now,
    );

    const { updated, opened } = await this.unitOfWork.run(async () => {
      const updatedUser = await this.users.setPassword(user.id, newHash, now);
      // Every existing session (including this one) dies; a fresh one replaces it.
      await this.sessions.revokeAllForUser(
        user.id,
        SessionRevocationReason.PASSWORD_CHANGED,
        now,
      );
      await this.resetTokens.invalidateAllForUser(user.id, now);
      // The replacement session stays on the client the change was made from.
      const session = await this.sessions.open(
        user.id,
        client,
        {
          persistent: currentSession?.persistent ?? true,
          channel: currentSession?.channel ?? channelForRole(user.role),
        },
        now,
      );
      await this.audit.record({
        action: AuditAction.PASSWORD_CHANGED,
        actor: { type: 'USER', userId: user.id },
        target: { type: 'USER', id: user.id },
        client,
        metadata: { wasTemporary: user.mustChangePassword },
      });
      // Replacing the temporary password is part of onboarding, not news.
      if (!user.mustChangePassword) {
        await this.notifications.notify(user.id, { type: 'PASSWORD_CHANGED' });
      }
      return { updated: updatedUser, opened: session };
    });

    return this.issueTokens(updated, opened, now);
  }

  /** Always resolves the same way, whether or not the account exists. */
  async requestPasswordReset(
    email: string,
    client: ClientContext,
  ): Promise<void> {
    const now = new Date();
    const user = await this.findUserByEmail(email);
    if (!user || !canAuthenticate(user.accountState)) return;

    const recentRequests = await this.resetTokens.countCreatedSince(
      user.id,
      new Date(now.getTime() - PasswordResetPolicy.WINDOW_MS),
    );
    if (recentRequests >= PasswordResetPolicy.MAX_REQUESTS_PER_WINDOW) {
      this.logger.warn(
        { userId: user.id, requestId: client.requestId },
        'Password reset request ignored: per-account limit reached',
      );
      return;
    }

    const rawToken = this.tokens.generateToken();
    const expiresAt = new Date(
      now.getTime() + this.auth.passwordResetTtlSeconds * 1000,
    );
    await this.unitOfWork.run(async () => {
      await this.resetTokens.invalidateAllForUser(user.id, now);
      await this.resetTokens.create({
        userId: user.id,
        tokenHash: this.tokens.hashToken(rawToken),
        expiresAt,
        requestedIp: client.ipAddress,
      });
      await this.audit.record({
        action: AuditAction.PASSWORD_RESET_REQUESTED,
        actor: { type: 'USER', userId: null },
        target: { type: 'USER', id: user.id },
        client,
      });
    });

    // Sent after commit and NOT awaited: the response time must not reveal
    // whether an email was sent (account enumeration by timing).
    this.mail
      .sendPasswordReset({
        to: user.email.value,
        firstName: user.firstName,
        // Fragment: the token never reaches server logs or Referer headers.
        resetUrl: `${this.app.frontendUrl}/reset-password#token=${rawToken}`,
        expiresAt,
      })
      .catch((err: unknown) =>
        this.logger.error(
          { err, requestId: client.requestId },
          'Password reset email could not be sent',
        ),
      );
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
    client: ClientContext,
  ): Promise<void> {
    const now = new Date();
    const { record, user } = await this.resolvePasswordResetToken(
      rawToken,
      now,
    );
    assertPasswordPolicy(newPassword, { email: user.email.value });
    const newHash = await this.hasher.hash(newPassword);

    await this.unitOfWork.run(async () => {
      // Conditional update: two concurrent submissions cannot both succeed.
      if (!(await this.resetTokens.consume(record.id, now))) {
        throw new InvalidPasswordResetTokenError();
      }
      await this.users.setPassword(user.id, newHash, now);
      await this.resetTokens.invalidateAllForUser(user.id, now);
      await this.sessions.revokeAllForUser(
        user.id,
        SessionRevocationReason.PASSWORD_CHANGED,
        now,
      );
      await this.audit.record({
        action: AuditAction.PASSWORD_RESET_COMPLETED,
        actor: { type: 'USER', userId: user.id },
        target: { type: 'USER', id: user.id },
        client,
      });
      await this.notifications.notify(user.id, { type: 'PASSWORD_CHANGED' });
    });
  }

  /**
   * Checks an emailed reset token without consuming it. The reset mutation still
   * repeats this validation and consumes the token conditionally, so a preview
   * cannot make a stale or concurrently used token valid.
   */
  async validatePasswordResetToken(rawToken: string): Promise<Date> {
    const { record } = await this.resolvePasswordResetToken(
      rawToken,
      new Date(),
    );
    return record.expiresAt;
  }

  private async resolvePasswordResetToken(
    rawToken: string,
    now: Date,
  ): Promise<{ record: PasswordResetTokenRecord; user: User }> {
    const record = await this.resetTokens.findByTokenHash(
      this.tokens.hashToken(rawToken),
    );
    if (!record || record.usedAt || record.expiresAt <= now) {
      throw new InvalidPasswordResetTokenError();
    }
    const user = await this.users.findById(record.userId);
    if (!user || !canAuthenticate(user.accountState)) {
      throw new InvalidPasswordResetTokenError();
    }
    return { record, user };
  }

  private async findUserByEmail(raw: string): Promise<User | null> {
    let email: Email;
    try {
      email = Email.create(raw);
    } catch {
      return null;
    }
    return this.users.findByEmail(email);
  }

  /** Spends the same Argon2 cost as a real verification when there is nothing to verify. */
  private async burnPasswordVerification(password: string): Promise<void> {
    this.dummyHash ??= this.hasher.hash(randomBytes(32).toString('hex'));
    await this.hasher.verify(await this.dummyHash, password);
  }

  private async registerFailedAttempt(
    userId: string,
    now: Date,
  ): Promise<void> {
    const attempts = await this.users.incrementFailedLoginAttempts(userId);
    if (attempts >= LoginPolicy.MAX_FAILED_ATTEMPTS) {
      await this.users.lockLogin(
        userId,
        new Date(now.getTime() + LoginPolicy.LOCK_DURATION_MS),
      );
    }
  }

  private auditLoginFailure(
    userId: string | null,
    reason: LoginFailureReason,
    client: ClientContext,
  ): Promise<void> {
    return this.audit.record({
      action: AuditAction.LOGIN_FAILED,
      outcome: 'FAILURE',
      actor: { type: 'USER', userId },
      ...(userId ? { target: { type: 'USER' as const, id: userId } } : {}),
      client,
      metadata: { reason },
    });
  }

  private async issueMfaChallenge(
    user: User,
    command: LoginCommand,
    now: Date,
  ): Promise<MfaChallengeIssued> {
    const mfaToken = this.tokens.generateToken();
    const expiresAt = new Date(
      now.getTime() + this.mfa.challengeTtlSeconds * 1000,
    );
    const challenge = await this.mfaChallenges.create({
      userId: user.id,
      tokenHash: this.tokens.hashToken(mfaToken),
      channel: command.channel,
      persistent: command.rememberMe,
      expiresAt,
    });
    await this.audit.record({
      action: AuditAction.MFA_CHALLENGE_ISSUED,
      actor: { type: 'USER', userId: user.id },
      target: { type: 'USER', id: user.id },
      client: command.client,
      metadata: { challengeId: challenge.id, channel: command.channel },
    });
    return { mfaToken, expiresAt };
  }

  /** Last step of every successful login (with or without a second factor). */
  private async openLoginSession(
    user: User,
    options: { persistent: boolean; channel: SessionChannel },
    login: {
      upgradedHash: string | null;
      mfaMethod: MfaMethod | null;
      challengeId?: string;
    },
    client: ClientContext,
    now: Date,
  ): Promise<IssuedTokens> {
    const opened = await this.unitOfWork.run(async () => {
      if (
        login.challengeId &&
        !(await this.mfaChallenges.consume(login.challengeId, now))
      ) {
        // Raced by a concurrent request presenting the same challenge.
        throw new MfaChallengeInvalidError();
      }
      await this.users.recordSuccessfulLogin(user.id, now, login.upgradedHash);
      const session = await this.sessions.open(user.id, client, options, now);
      await this.audit.record({
        action: AuditAction.LOGIN_SUCCEEDED,
        actor: { type: 'USER', userId: user.id },
        target: { type: 'USER', id: user.id },
        client,
        metadata: {
          sessionId: session.session.id,
          channel: options.channel,
          ...(login.mfaMethod ? { mfa: login.mfaMethod } : {}),
        },
      });
      await this.notifyNewSignIn(user.id, session.session.id, client, now);
      return session;
    });
    return this.issueTokens(user, opened, now);
  }

  /**
   * Tells the account owner about a sign-in when another device is already
   * signed in: that device is where an unexpected sign-in gets noticed. A
   * first sign-in (nothing else signed in) is not news.
   */
  private async notifyNewSignIn(
    userId: string,
    sessionId: string,
    client: ClientContext,
    now: Date,
  ): Promise<void> {
    if (!(await this.sessions.countOtherActive(userId, sessionId, now))) {
      return;
    }
    await this.notifications.notify(userId, {
      type: 'NEW_SIGN_IN',
      deviceLabel: describeUserAgent(client.userAgent).label,
    });
  }

  private issueTokens(
    user: User,
    opened: OpenedSession,
    now: Date,
  ): IssuedTokens {
    const access = this.accessTokens.issue(user.id, opened.session.id, now);
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: opened.refreshToken,
      refreshTokenExpiresAt: opened.refreshTokenExpiresAt,
      persistent: opened.session.persistent,
      principal: {
        userId: user.id,
        sessionId: opened.session.id,
        role: user.role,
        accountState: user.accountState,
      },
    };
  }
}
