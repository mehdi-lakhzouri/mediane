import { Injectable } from '@nestjs/common';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import {
  PasswordResetTokenRecord,
  PasswordResetTokenRepository,
} from '../domain/password-reset-token.repository';

@Injectable()
export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly db: PrismaTransactionHost) {}

  async create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    requestedIp: string | null;
  }): Promise<void> {
    await this.db.client.passwordResetToken.create({ data });
  }

  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    return this.db.client.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
  }

  countCreatedSince(userId: string, since: Date): Promise<number> {
    return this.db.client.passwordResetToken.count({
      where: { userId, createdAt: { gte: since } },
    });
  }

  async consume(tokenId: string, now: Date): Promise<boolean> {
    const { count } = await this.db.client.passwordResetToken.updateMany({
      where: { id: tokenId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return count === 1;
  }

  async invalidateAllForUser(userId: string, now: Date): Promise<void> {
    await this.db.client.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    });
  }
}
