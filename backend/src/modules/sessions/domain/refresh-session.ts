export const SessionRevocationReason = {
  LOGOUT: 'LOGOUT',
  LOGOUT_ALL: 'LOGOUT_ALL',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_DELETED: 'USER_DELETED',
  ADMIN_REVOKED: 'ADMIN_REVOKED',
} as const;
export type SessionRevocationReason =
  (typeof SessionRevocationReason)[keyof typeof SessionRevocationReason];

export interface RefreshSessionProps {
  id: string;
  userId: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  persistent: boolean;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: SessionRevocationReason | null;
  createdAt: Date;
}

/**
 * A logged-in device. Token hashes are deliberately not part of the domain object:
 * they are a persistence concern handled by the repository.
 */
export class RefreshSession {
  private constructor(private readonly props: RefreshSessionProps) {}

  static rehydrate(props: RefreshSessionProps): RefreshSession {
    return new RefreshSession(props);
  }

  /** Sliding expiry for a new session, capped by the absolute lifetime. */
  static initialExpiries(
    now: Date,
    ttl: { idleSeconds: number; absoluteSeconds: number },
  ): { expiresAt: Date; absoluteExpiresAt: Date } {
    const absoluteExpiresAt = addSeconds(now, ttl.absoluteSeconds);
    return {
      expiresAt: minDate(addSeconds(now, ttl.idleSeconds), absoluteExpiresAt),
      absoluteExpiresAt,
    };
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get persistent(): boolean {
    return this.props.persistent;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  isActive(now: Date): boolean {
    return (
      this.props.revokedAt === null &&
      this.props.expiresAt > now &&
      this.props.absoluteExpiresAt > now
    );
  }

  /** Next sliding expiry on rotation: never beyond the absolute lifetime. */
  nextExpiry(now: Date, idleSeconds: number): Date {
    return minDate(addSeconds(now, idleSeconds), this.props.absoluteExpiresAt);
  }

  /**
   * True if the session was rotated less than `windowMs` ago. Used to tell a
   * benign race (two tabs refreshing at once with the same cookie) from a replay.
   */
  wasRotatedWithin(windowMs: number, now: Date): boolean {
    return (
      this.props.lastUsedAt !== null &&
      now.getTime() - this.props.lastUsedAt.getTime() < windowMs
    );
  }
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function minDate(a: Date, b: Date): Date {
  return a <= b ? a : b;
}
