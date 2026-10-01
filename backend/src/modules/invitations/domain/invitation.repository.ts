import { Invitation } from './invitation';

export interface NewInvitationData {
  userId: string;
  invitedById: string;
  /** HMAC of the raw token. The raw token only ever exists in the email link. */
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Port. Lookups by token always take the HASH (the raw token never reaches
 * persistence).
 */
export abstract class InvitationRepository {
  abstract findByTokenHash(tokenHash: string): Promise<Invitation | null>;

  abstract findLatestForUser(userId: string): Promise<Invitation | null>;

  abstract create(data: NewInvitationData): Promise<Invitation>;

  /**
   * Marks every still-pending invitation of the user SUPERSEDED, so at most one
   * can be accepted. Returns how many were superseded.
   */
  abstract supersedePendingForUser(userId: string, now: Date): Promise<number>;

  /**
   * Revokes the invitation if it is still pending. Returns false when it was
   * already accepted, revoked or superseded.
   */
  /**
   * Consumes the invitation in one conditional update
   * (`tokenHash` + PENDING + not expired). Returns null when it was already
   * accepted, revoked, superseded or has expired, so two concurrent replays of
   * the same link can never both succeed.
   */
  abstract accept(
    tokenHash: string,
    now: Date,
  ): Promise<{ invitationId: string; userId: string } | null>;

  abstract revoke(
    invitationId: string,
    revokedById: string,
    now: Date,
  ): Promise<boolean>;
}
