import { Injectable } from '@nestjs/common';
import type { RefreshSession as RefreshSessionRecord } from '../../../generated/prisma/client';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import {
  RefreshSession,
  SessionRevocationReason,
} from '../domain/refresh-session';
import {
  NewRefreshSessionData,
  RefreshSessionRepository,
  RotationData,
  SessionSummary,
  TouchSessionData,
} from '../domain/refresh-session.repository';

type SessionRow = Omit<RefreshSessionRecord, 'tokenHash' | 'previousTokenHash'>;

// Token hashes never leave the repository.
const OMIT_HASHES = { tokenHash: true, previousTokenHash: true } as const;

function toDomain(row: SessionRow): RefreshSession {
  return RefreshSession.rehydrate({
    id: row.id,
    userId: row.userId,
    expiresAt: row.expiresAt,
    absoluteExpiresAt: row.absoluteExpiresAt,
    persistent: row.persistent,
    channel: row.channel,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    revokedReason: row.revokedReason,
    createdAt: row.createdAt,
  });
}

@Injectable()
export class PrismaRefreshSessionRepository implements RefreshSessionRepository {
  constructor(private readonly db: PrismaTransactionHost) {}

  async findById(id: string): Promise<RefreshSession | null> {
    const row = await this.db.client.refreshSession.findUnique({
      where: { id },
      omit: OMIT_HASHES,
    });
    return row ? toDomain(row) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshSession | null> {
    const row = await this.db.client.refreshSession.findUnique({
      where: { tokenHash },
      omit: OMIT_HASHES,
    });
    return row ? toDomain(row) : null;
  }

  async findByPreviousTokenHash(
    tokenHash: string,
  ): Promise<RefreshSession | null> {
    const row = await this.db.client.refreshSession.findUnique({
      where: { previousTokenHash: tokenHash },
      omit: OMIT_HASHES,
    });
    return row ? toDomain(row) : null;
  }

  async create(data: NewRefreshSessionData): Promise<RefreshSession> {
    const row = await this.db.client.refreshSession.create({
      data,
      omit: OMIT_HASHES,
    });
    return toDomain(row);
  }

  async rotate(data: RotationData): Promise<RefreshSession | null> {
    const { count } = await this.db.client.refreshSession.updateMany({
      where: {
        id: data.sessionId,
        tokenHash: data.currentTokenHash,
        revokedAt: null,
      },
      data: {
        tokenHash: data.newTokenHash,
        previousTokenHash: data.currentTokenHash,
        expiresAt: data.expiresAt,
        lastUsedAt: data.now,
      },
    });
    return count === 1 ? this.findById(data.sessionId) : null;
  }

  async touch(data: TouchSessionData): Promise<boolean> {
    const { count } = await this.db.client.refreshSession.updateMany({
      where: {
        id: data.sessionId,
        revokedAt: null,
        expiresAt: { gt: data.now },
        absoluteExpiresAt: { gt: data.now },
      },
      data: { expiresAt: data.expiresAt, lastUsedAt: data.now },
    });
    return count === 1;
  }

  async revoke(
    sessionId: string,
    reason: SessionRevocationReason,
    now: Date,
  ): Promise<boolean> {
    const { count } = await this.db.client.refreshSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    });
    return count === 1;
  }

  async revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
    now: Date,
  ): Promise<number> {
    const { count } = await this.db.client.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    });
    return count;
  }

  async listActiveForUser(
    userId: string,
    now: Date,
  ): Promise<SessionSummary[]> {
    const rows = await this.db.client.refreshSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      select: {
        id: true,
        channel: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
    const activity = (row: SessionSummary): number =>
      (row.lastUsedAt ?? row.createdAt).getTime();
    return rows.sort((a, b) => activity(b) - activity(a));
  }

  async revokeAllForUserExcept(
    userId: string,
    keepSessionId: string,
    reason: SessionRevocationReason,
    now: Date,
  ): Promise<number> {
    const { count } = await this.db.client.refreshSession.updateMany({
      where: { userId, revokedAt: null, id: { not: keepSessionId } },
      data: { revokedAt: now, revokedReason: reason },
    });
    return count;
  }
}
