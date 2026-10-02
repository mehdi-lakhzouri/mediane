import { Injectable } from '@nestjs/common';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import {
  MfaChallengeRecord,
  MfaChallengeRepository,
  NewMfaChallenge,
} from '../domain/mfa-challenge.repository';

const PUBLIC_FIELDS = {
  id: true,
  userId: true,
  channel: true,
  persistent: true,
  failedAttempts: true,
  expiresAt: true,
  consumedAt: true,
} as const;

@Injectable()
export class PrismaMfaChallengeRepository implements MfaChallengeRepository {
  constructor(private readonly db: PrismaTransactionHost) {}

  create(data: NewMfaChallenge): Promise<MfaChallengeRecord> {
    return this.db.client.mfaChallenge.create({ data, select: PUBLIC_FIELDS });
  }

  findByTokenHash(tokenHash: string): Promise<MfaChallengeRecord | null> {
    return this.db.client.mfaChallenge.findUnique({
      where: { tokenHash },
      select: PUBLIC_FIELDS,
    });
  }

  async recordFailure(challengeId: string): Promise<void> {
    await this.db.client.mfaChallenge.update({
      where: { id: challengeId },
      data: { failedAttempts: { increment: 1 } },
    });
  }

  async consume(challengeId: string, now: Date): Promise<boolean> {
    const { count } = await this.db.client.mfaChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { consumedAt: now },
    });
    return count === 1;
  }
}
