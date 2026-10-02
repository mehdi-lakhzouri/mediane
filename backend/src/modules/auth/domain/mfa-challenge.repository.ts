import type { SessionChannel } from '../../sessions/domain/refresh-session';

export interface MfaChallengeRecord {
  id: string;
  userId: string;
  channel: SessionChannel;
  persistent: boolean;
  failedAttempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface NewMfaChallenge {
  userId: string;
  tokenHash: string;
  channel: SessionChannel;
  persistent: boolean;
  expiresAt: Date;
}

/** Port. Challenges are looked up by the HMAC of the raw token, never the token. */
export abstract class MfaChallengeRepository {
  abstract create(data: NewMfaChallenge): Promise<MfaChallengeRecord>;

  abstract findByTokenHash(
    tokenHash: string,
  ): Promise<MfaChallengeRecord | null>;

  abstract recordFailure(challengeId: string): Promise<void>;

  /** Atomic: only one request can consume a challenge. */
  abstract consume(challengeId: string, now: Date): Promise<boolean>;
}
