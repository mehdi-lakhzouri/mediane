export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/** Port. Tokens are single-use and only their HMAC hash is stored. */
export abstract class PasswordResetTokenRepository {
  abstract create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    requestedIp: string | null;
  }): Promise<void>;

  abstract findByTokenHash(
    tokenHash: string,
  ): Promise<PasswordResetTokenRecord | null>;

  abstract countCreatedSince(userId: string, since: Date): Promise<number>;

  /**
   * Conditional single-use consumption (`usedAt IS NULL AND expiresAt > now`).
   * Returns false if another request consumed it first or it expired.
   */
  abstract consume(tokenId: string, now: Date): Promise<boolean>;

  /** Invalidates every still-unused token of the user (new request, password set). */
  abstract invalidateAllForUser(userId: string, now: Date): Promise<void>;
}
