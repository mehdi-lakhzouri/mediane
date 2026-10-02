/** Encrypted secrets as stored; decryption happens in the application layer. */
export interface StoredMfaSecrets {
  activeSecretEnc: string | null;
  lastUsedStep: number | null;
  pendingSecretEnc: string | null;
  pendingExpiresAt: Date | null;
}

/**
 * Port for the MFA credential of a user (TOTP + recovery codes). Recovery
 * codes are only ever handled as keyed hashes. Multi-step writes must run
 * inside a UnitOfWork.
 */
export abstract class UserMfaRepository {
  abstract findSecrets(userId: string): Promise<StoredMfaSecrets | null>;

  /** Starts (or restarts) a setup; the active secret, if any, is untouched. */
  abstract savePendingSecret(
    userId: string,
    secretEnc: string,
    expiresAt: Date,
  ): Promise<void>;

  /** Pending secret becomes the active one; `usedStep` is the confirming code's step. */
  abstract activatePendingSecret(
    userId: string,
    usedStep: number,
  ): Promise<void>;

  /**
   * Atomically records `step` as used if it is newer than the last used one.
   * Returns false for a replayed (or older) code.
   */
  abstract consumeTotpStep(userId: string, step: number): Promise<boolean>;

  /** Removes the authenticator and every recovery code. */
  abstract deleteAll(userId: string): Promise<void>;

  abstract replaceRecoveryCodes(
    userId: string,
    codeHashes: readonly string[],
  ): Promise<void>;

  /** Atomically marks an unused code as used. False if unknown or already used. */
  abstract consumeRecoveryCode(
    userId: string,
    codeHash: string,
    now: Date,
  ): Promise<boolean>;

  abstract countUnusedRecoveryCodes(userId: string): Promise<number>;
}
