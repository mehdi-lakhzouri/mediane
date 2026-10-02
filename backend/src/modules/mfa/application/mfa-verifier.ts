import { Injectable } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action';
import { LoginPolicy } from '../../auth/domain/login-policy';
import { SecureTokenService } from '../../security/infrastructure/secure-token.service';
import { UserRepository } from '../../users/domain/user.repository';
import { InvalidMfaCodeError } from '../domain/mfa.errors';
import {
  looksLikeRecoveryCode,
  normalizeRecoveryCode,
} from '../domain/recovery-codes';
import { matchTotpStep } from '../domain/totp';
import { UserMfaRepository } from '../domain/user-mfa.repository';
import { MfaSecretCipher } from '../infrastructure/mfa-secret.cipher';

export type MfaMethod = 'TOTP' | 'RECOVERY_CODE';

/** Why a code is being checked (audit trail only). */
export type MfaPurpose =
  | 'LOGIN'
  | 'PASSWORD_CHANGE'
  | 'RECOVERY_CODES_REGENERATION'
  | 'DISABLE'
  | 'AUTHENTICATOR_REPLACEMENT';

/**
 * Checks a second-factor code for a user who has MFA enabled: either a
 * 6-digit TOTP code (never accepted twice) or a single-use recovery code.
 * Every failure counts towards the same per-account lock as wrong passwords,
 * so the 10^6 code space cannot be brute-forced across many challenges.
 */
@Injectable()
export class MfaVerifier {
  constructor(
    private readonly mfa: UserMfaRepository,
    private readonly cipher: MfaSecretCipher,
    private readonly tokens: SecureTokenService,
    private readonly users: UserRepository,
    private readonly audit: AuditService,
  ) {}

  /** @throws InvalidMfaCodeError */
  async verify(
    userId: string,
    code: string,
    purpose: MfaPurpose,
    client: ClientContext,
    now = new Date(),
  ): Promise<MfaMethod> {
    const method = await this.tryVerify(userId, code.trim(), now);
    if (method) {
      if (method === 'RECOVERY_CODE') {
        await this.audit.record({
          action: AuditAction.MFA_RECOVERY_CODE_USED,
          actor: { type: 'USER', userId },
          target: { type: 'USER', id: userId },
          client,
          metadata: {
            purpose,
            remaining: await this.mfa.countUnusedRecoveryCodes(userId),
          },
        });
      }
      return method;
    }

    const attempts = await this.users.incrementFailedLoginAttempts(userId);
    if (attempts >= LoginPolicy.MAX_FAILED_ATTEMPTS) {
      await this.users.lockLogin(
        userId,
        new Date(now.getTime() + LoginPolicy.LOCK_DURATION_MS),
      );
    }
    await this.audit.record({
      action: AuditAction.MFA_VERIFICATION_FAILED,
      outcome: 'FAILURE',
      actor: { type: 'USER', userId },
      target: { type: 'USER', id: userId },
      client,
      metadata: { purpose },
    });
    throw new InvalidMfaCodeError();
  }

  /** Keyed hash bound to the user: the same code means nothing for anyone else. */
  hashRecoveryCode(userId: string, code: string): string {
    return this.tokens.hmac(
      `mfa-recovery:${userId}:${normalizeRecoveryCode(code)}`,
    );
  }

  private async tryVerify(
    userId: string,
    code: string,
    now: Date,
  ): Promise<MfaMethod | null> {
    if (/^\d{6}$/.test(code)) {
      const stored = await this.mfa.findSecrets(userId);
      if (!stored?.activeSecretEnc) return null;
      const secret = this.cipher.decrypt(stored.activeSecretEnc, userId);
      const step = matchTotpStep(secret, code, now);
      if (step === null) return null;
      return (await this.mfa.consumeTotpStep(userId, step)) ? 'TOTP' : null;
    }
    if (looksLikeRecoveryCode(code)) {
      const used = await this.mfa.consumeRecoveryCode(
        userId,
        this.hashRecoveryCode(userId, code),
        now,
      );
      return used ? 'RECOVERY_CODE' : null;
    }
    return null;
  }
}
