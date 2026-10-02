import { Injectable } from '@nestjs/common';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import {
  StoredMfaSecrets,
  UserMfaRepository,
} from '../domain/user-mfa.repository';

@Injectable()
export class PrismaUserMfaRepository implements UserMfaRepository {
  constructor(private readonly db: PrismaTransactionHost) {}

  async findSecrets(userId: string): Promise<StoredMfaSecrets | null> {
    const row = await this.db.client.userMfa.findUnique({ where: { userId } });
    return row
      ? {
          activeSecretEnc: row.totpSecretEnc,
          lastUsedStep: row.totpLastUsedStep,
          pendingSecretEnc: row.pendingTotpSecretEnc,
          pendingExpiresAt: row.pendingTotpExpiresAt,
        }
      : null;
  }

  async savePendingSecret(
    userId: string,
    secretEnc: string,
    expiresAt: Date,
  ): Promise<void> {
    const pending = {
      pendingTotpSecretEnc: secretEnc,
      pendingTotpExpiresAt: expiresAt,
    };
    await this.db.client.userMfa.upsert({
      where: { userId },
      create: { userId, ...pending },
      update: pending,
    });
  }

  async activatePendingSecret(userId: string, usedStep: number): Promise<void> {
    const row = await this.db.client.userMfa.findUniqueOrThrow({
      where: { userId },
      select: { pendingTotpSecretEnc: true },
    });
    await this.db.client.userMfa.update({
      where: { userId },
      data: {
        totpSecretEnc: row.pendingTotpSecretEnc,
        totpLastUsedStep: usedStep,
        pendingTotpSecretEnc: null,
        pendingTotpExpiresAt: null,
      },
    });
  }

  async consumeTotpStep(userId: string, step: number): Promise<boolean> {
    // Compare-and-set: two requests with the same code cannot both pass.
    const { count } = await this.db.client.userMfa.updateMany({
      where: {
        userId,
        totpSecretEnc: { not: null },
        OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: step } }],
      },
      data: { totpLastUsedStep: step },
    });
    return count === 1;
  }

  async deleteAll(userId: string): Promise<void> {
    await this.db.client.mfaRecoveryCode.deleteMany({ where: { userId } });
    await this.db.client.userMfa.deleteMany({ where: { userId } });
  }

  async replaceRecoveryCodes(
    userId: string,
    codeHashes: readonly string[],
  ): Promise<void> {
    await this.db.client.mfaRecoveryCode.deleteMany({ where: { userId } });
    await this.db.client.mfaRecoveryCode.createMany({
      data: codeHashes.map((codeHash) => ({ userId, codeHash })),
    });
  }

  async consumeRecoveryCode(
    userId: string,
    codeHash: string,
    now: Date,
  ): Promise<boolean> {
    const { count } = await this.db.client.mfaRecoveryCode.updateMany({
      where: { userId, codeHash, usedAt: null },
      data: { usedAt: now },
    });
    return count === 1;
  }

  countUnusedRecoveryCodes(userId: string): Promise<number> {
    return this.db.client.mfaRecoveryCode.count({
      where: { userId, usedAt: null },
    });
  }
}
