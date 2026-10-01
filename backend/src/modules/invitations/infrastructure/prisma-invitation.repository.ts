import { Injectable } from '@nestjs/common';
import type { Invitation as InvitationRecord } from '../../../generated/prisma/client';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import { Invitation, InvitationStatus } from '../domain/invitation';
import {
  InvitationRepository,
  NewInvitationData,
} from '../domain/invitation.repository';

type InvitationRow = Omit<InvitationRecord, 'tokenHash' | 'updatedAt'>;

const SELECT = {
  id: true,
  userId: true,
  invitedById: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  revokedById: true,
  createdAt: true,
} as const;

function toDomain(row: InvitationRow): Invitation {
  return Invitation.rehydrate(row);
}

@Injectable()
export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly db: PrismaTransactionHost) {}

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const row = await this.db.client.invitation.findUnique({
      where: { tokenHash },
      select: SELECT,
    });
    return row ? toDomain(row) : null;
  }

  async findLatestForUser(userId: string): Promise<Invitation | null> {
    const row = await this.db.client.invitation.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });
    return row ? toDomain(row) : null;
  }

  async create(data: NewInvitationData): Promise<Invitation> {
    const row = await this.db.client.invitation.create({
      data,
      select: SELECT,
    });
    return toDomain(row);
  }

  async supersedePendingForUser(userId: string, now: Date): Promise<number> {
    const { count } = await this.db.client.invitation.updateMany({
      where: { userId, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.SUPERSEDED, updatedAt: now },
    });
    return count;
  }

  async revoke(
    invitationId: string,
    revokedById: string,
    now: Date,
  ): Promise<boolean> {
    const { count } = await this.db.client.invitation.updateMany({
      where: { id: invitationId, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.REVOKED, revokedAt: now, revokedById },
    });
    return count === 1;
  }

  async accept(
    tokenHash: string,
    now: Date,
  ): Promise<{ invitationId: string; userId: string } | null> {
    const row = await this.db.client.invitation.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true },
    });
    if (!row) return null;

    // The guard lives in the WHERE clause, not in a prior read: that is what
    // makes a replayed link lose the race instead of being accepted twice.
    const { count } = await this.db.client.invitation.updateMany({
      where: {
        id: row.id,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: now },
      },
      data: { status: InvitationStatus.ACCEPTED, acceptedAt: now },
    });
    return count === 1 ? { invitationId: row.id, userId: row.userId } : null;
  }
}
