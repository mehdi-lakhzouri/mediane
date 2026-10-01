import { RefreshSession, SessionRevocationReason } from './refresh-session';

export interface NewRefreshSessionData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  persistent: boolean;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface RotationData {
  sessionId: string;
  /** Hash the caller presented: the update only applies if it is still current. */
  currentTokenHash: string;
  newTokenHash: string;
  expiresAt: Date;
  now: Date;
}

/** Port. Lookups by token always take the HMAC hash, never the raw token. */
export abstract class RefreshSessionRepository {
  abstract findById(id: string): Promise<RefreshSession | null>;

  abstract findByTokenHash(tokenHash: string): Promise<RefreshSession | null>;

  abstract findByPreviousTokenHash(
    tokenHash: string,
  ): Promise<RefreshSession | null>;

  abstract create(data: NewRefreshSessionData): Promise<RefreshSession>;

  /**
   * Atomic compare-and-swap: current hash -> previous, new hash -> current.
   * Returns null when another request rotated or revoked the session first.
   */
  abstract rotate(data: RotationData): Promise<RefreshSession | null>;

  /** Returns false if the session was already revoked. */
  abstract revoke(
    sessionId: string,
    reason: SessionRevocationReason,
    now: Date,
  ): Promise<boolean>;

  /** Revokes every active session of the user. Returns how many were revoked. */
  abstract revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
    now: Date,
  ): Promise<number>;
}
