import { Inject, Injectable } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { mfaConfig, type MfaConfig } from '../../../config';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { SessionsService } from '../../sessions/application/sessions.service';
import { SessionRevocationReason } from '../../sessions/domain/refresh-session';
import { AccountState, isMfaRequired } from '../../users/domain/account-state';
import { User } from '../../users/domain/user';
import { UserNotFoundError } from '../../users/domain/user.errors';
import { UserRepository } from '../../users/domain/user.repository';
import {
  InvalidMfaCodeError,
  MfaCodeRequiredError,
  MfaNotEnabledError,
  MfaRequiredForRoleError,
  MfaSetupNotStartedError,
} from '../domain/mfa.errors';
import {
  generateRecoveryCodes,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODES_LOW_WATERMARK,
} from '../domain/recovery-codes';
import {
  base32Encode,
  generateTotpSecret,
  matchTotpStep,
  otpauthUri,
  TOTP_PARAMETERS,
} from '../domain/totp';
import { UserMfaRepository } from '../domain/user-mfa.repository';
import { MfaSecretCipher } from '../infrastructure/mfa-secret.cipher';
import { MfaVerifier } from './mfa-verifier';

export interface MfaStatusView {
  enabled: boolean;
  enabledAt: Date | null;
  /** True for roles that cannot turn MFA off (none at the moment). */
  required: boolean;
  recoveryCodesRemaining: number;
  /** Clients should suggest regenerating below this. */
  recoveryCodesLow: boolean;
}

/** What an authenticator app needs. Shown during setup only, never again. */
export interface TotpSetupView {
  /** Base32, for manual entry ("can't scan?"). */
  secret: string;
  /** Render as a QR code, or open it on the same phone. */
  otpauthUri: string;
  issuer: string;
  accountName: string;
  algorithm: string;
  digits: number;
  period: number;
  expiresAt: Date;
}

export interface RecoveryCodesView {
  /** Displayed once: only their hashes are kept. */
  recoveryCodes: string[];
  accountState: AccountState;
}

/**
 * Self-service TOTP management. A setup is two-step (start -> confirm with a
 * code) so a mis-scanned QR never locks anyone out; replacing an active
 * authenticator keeps the old one working until the new one is confirmed.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly mfa: UserMfaRepository,
    private readonly users: UserRepository,
    private readonly verifier: MfaVerifier,
    private readonly cipher: MfaSecretCipher,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly unitOfWork: UnitOfWork,
    private readonly notifications: NotificationsService,
    @Inject(mfaConfig.KEY) private readonly config: MfaConfig,
  ) {}

  async getStatus(userId: string): Promise<MfaStatusView> {
    const user = await this.requireUser(userId);
    const remaining = user.hasMfa
      ? await this.mfa.countUnusedRecoveryCodes(userId)
      : 0;
    return {
      enabled: user.hasMfa,
      enabledAt: user.mfaEnabledAt,
      required: isMfaRequired(user.role),
      recoveryCodesRemaining: remaining,
      recoveryCodesLow:
        user.hasMfa && remaining <= RECOVERY_CODES_LOW_WATERMARK,
    };
  }

  /**
   * Starts a setup. Replacing an active authenticator (new phone) needs a
   * code from the current one, or a recovery code if the phone is lost.
   */
  async startTotpSetup(
    userId: string,
    stepUpCode: string | undefined,
    client: ClientContext,
  ): Promise<TotpSetupView> {
    const now = new Date();
    const user = await this.requireUser(userId);
    if (user.hasMfa) {
      if (!stepUpCode) throw new MfaCodeRequiredError();
      await this.verifier.verify(
        userId,
        stepUpCode,
        'AUTHENTICATOR_REPLACEMENT',
        client,
        now,
      );
    }

    const secret = generateTotpSecret();
    const expiresAt = new Date(
      now.getTime() + this.config.setupTtlSeconds * 1000,
    );
    await this.mfa.savePendingSecret(
      userId,
      this.cipher.encrypt(secret, userId),
      expiresAt,
    );
    const accountName = user.email.value;
    return {
      secret: base32Encode(secret),
      otpauthUri: otpauthUri({
        issuer: this.config.issuer,
        accountName,
        secret,
      }),
      issuer: this.config.issuer,
      accountName,
      algorithm: TOTP_PARAMETERS.algorithm,
      digits: TOTP_PARAMETERS.digits,
      period: TOTP_PARAMETERS.periodSeconds,
      expiresAt,
    };
  }

  /**
   * Proves the app was set up correctly, activates it and issues a fresh set
   * of recovery codes (any previous set stops working).
   */
  async confirmTotpSetup(
    userId: string,
    code: string,
    client: ClientContext,
  ): Promise<RecoveryCodesView> {
    const now = new Date();
    const user = await this.requireUser(userId);
    const stored = await this.mfa.findSecrets(userId);
    if (
      !stored?.pendingSecretEnc ||
      !stored.pendingExpiresAt ||
      stored.pendingExpiresAt <= now
    ) {
      throw new MfaSetupNotStartedError();
    }
    const secret = this.cipher.decrypt(stored.pendingSecretEnc, userId);
    const step = matchTotpStep(secret, code.trim(), now);
    // Typos are expected here: rate-limited, not counted towards the login lock.
    if (step === null) throw new InvalidMfaCodeError();

    const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    const replacing = user.hasMfa;
    await this.unitOfWork.run(async () => {
      await this.mfa.activatePendingSecret(userId, step);
      await this.mfa.replaceRecoveryCodes(
        userId,
        recoveryCodes.map((c) => this.verifier.hashRecoveryCode(userId, c)),
      );
      if (!replacing) await this.users.setMfaEnabledAt(userId, now);
      await this.audit.record({
        action: replacing
          ? AuditAction.MFA_AUTHENTICATOR_REPLACED
          : AuditAction.MFA_ENABLED,
        actor: { type: 'USER', userId },
        target: { type: 'USER', id: userId },
        client,
      });
      if (!replacing) {
        await this.notifications.notify(userId, { type: 'TWO_STEP_ENABLED' });
      }
    });
    return { recoveryCodes, accountState: await this.stateOf(userId) };
  }

  async regenerateRecoveryCodes(
    userId: string,
    code: string,
    client: ClientContext,
  ): Promise<RecoveryCodesView> {
    const user = await this.requireUser(userId);
    if (!user.hasMfa) throw new MfaNotEnabledError();
    await this.verifier.verify(
      userId,
      code,
      'RECOVERY_CODES_REGENERATION',
      client,
    );

    const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    await this.unitOfWork.run(async () => {
      await this.mfa.replaceRecoveryCodes(
        userId,
        recoveryCodes.map((c) => this.verifier.hashRecoveryCode(userId, c)),
      );
      await this.audit.record({
        action: AuditAction.MFA_RECOVERY_CODES_REGENERATED,
        actor: { type: 'USER', userId },
        target: { type: 'USER', id: userId },
        client,
      });
    });
    return { recoveryCodes, accountState: user.accountState };
  }

  /**
   * Only for roles where MFA is optional (currently every role). Needs a
   * current code or a recovery code; afterwards the password alone signs in.
   */
  async disable(
    userId: string,
    code: string,
    client: ClientContext,
  ): Promise<MfaStatusView> {
    const user = await this.requireUser(userId);
    if (isMfaRequired(user.role)) throw new MfaRequiredForRoleError();
    if (!user.hasMfa) throw new MfaNotEnabledError();
    await this.verifier.verify(userId, code, 'DISABLE', client);

    await this.unitOfWork.run(async () => {
      await this.mfa.deleteAll(userId);
      await this.users.setMfaEnabledAt(userId, null);
      await this.audit.record({
        action: AuditAction.MFA_DISABLED,
        actor: { type: 'USER', userId },
        target: { type: 'USER', id: userId },
        client,
      });
      await this.notifications.notify(userId, { type: 'TWO_STEP_DISABLED' });
    });
    return this.getStatus(userId);
  }

  /**
   * Lost phone AND recovery codes: an administrator removes the
   * authenticator. Every session of the user is revoked; their next sign-in
   * takes the password alone, and they may set up a new authenticator.
   * Callers enforce who may do this (never on oneself).
   */
  async resetForUser(
    targetUserId: string,
    actorUserId: string,
    client: ClientContext,
  ): Promise<void> {
    const target = await this.requireUser(targetUserId);
    if (!target.hasMfa) throw new MfaNotEnabledError();
    const now = new Date();
    await this.unitOfWork.run(async () => {
      await this.mfa.deleteAll(targetUserId);
      await this.users.setMfaEnabledAt(targetUserId, null);
      await this.sessions.revokeAllForUser(
        targetUserId,
        SessionRevocationReason.ADMIN_REVOKED,
        now,
      );
      await this.audit.record({
        action: AuditAction.MFA_RESET_BY_ADMIN,
        actor: { type: 'USER', userId: actorUserId },
        target: { type: 'USER', id: targetUserId },
        client,
      });
    });
  }

  private async stateOf(userId: string): Promise<AccountState> {
    return (await this.requireUser(userId)).accountState;
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new UserNotFoundError();
    return user;
  }
}
