import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Invitation as InvitationRecord,
} from '../../../generated/prisma/client';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import { Invitation, InvitationStatus } from '../domain/invitation';
import {
  AdminInvitationListFilter,
  AdminInvitationRecord,
  AdminInvitationStatsRecord,
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

const ADMIN_SELECT = {
  id: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      deletedAt: true,
    },
  },
  invitedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

type AdminInvitationRow = Prisma.InvitationGetPayload<{
  select: typeof ADMIN_SELECT;
}>;

function toDomain(row: InvitationRow): Invitation {
  return Invitation.rehydrate(row);
}

function toAdminRecord(
  row: AdminInvitationRow,
  now: Date,
): AdminInvitationRecord {
  return {
    invitationId: row.id,
    userId: row.user.id,
    email: row.user.email,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    role: row.user.role,
    userStatus: row.user.status,
    userDeletedAt: row.user.deletedAt,
    status:
      row.status === InvitationStatus.PENDING && row.expiresAt <= now
        ? 'EXPIRED'
        : row.status,
    invitedBy: row.invitedBy
      ? {
          userId: row.invitedBy.id,
          firstName: row.invitedBy.firstName,
          lastName: row.invitedBy.lastName,
        }
      : null,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
  };
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

  async adminList(
    filter: AdminInvitationListFilter,
    now: Date,
  ): Promise<{ items: AdminInvitationRecord[]; totalItems: number }> {
    const search = filter.search?.trim();
    const statusWhere: Prisma.InvitationWhereInput =
      filter.status === 'EXPIRED'
        ? { status: InvitationStatus.PENDING, expiresAt: { lte: now } }
        : filter.status === InvitationStatus.PENDING
          ? { status: InvitationStatus.PENDING, expiresAt: { gt: now } }
          : filter.status
            ? { status: filter.status }
            : {};
    const where: Prisma.InvitationWhereInput = {
      ...statusWhere,
      user: {
        ...(filter.role ? { role: filter.role } : {}),
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    };
    const direction = filter.sortDir ?? 'desc';
    const primaryOrder: Prisma.InvitationOrderByWithRelationInput =
      filter.sortBy === 'email'
        ? { user: { email: direction } }
        : filter.sortBy === 'status'
          ? { status: direction }
          : filter.sortBy === 'expiresAt'
            ? { expiresAt: direction }
            : { createdAt: direction };

    const [rows, totalItems] = await Promise.all([
      this.db.client.invitation.findMany({
        where,
        select: ADMIN_SELECT,
        orderBy: [primaryOrder, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.db.client.invitation.count({ where }),
    ]);

    return {
      items: rows.map((row) => toAdminRecord(row, now)),
      totalItems,
    };
  }

  async adminStats(now: Date): Promise<AdminInvitationStatsRecord> {
    const [total, pending, accepted, expired, revoked, superseded] =
      await Promise.all([
        this.db.client.invitation.count(),
        this.db.client.invitation.count({
          where: { status: InvitationStatus.PENDING, expiresAt: { gt: now } },
        }),
        this.db.client.invitation.count({
          where: { status: InvitationStatus.ACCEPTED },
        }),
        this.db.client.invitation.count({
          where: { status: InvitationStatus.PENDING, expiresAt: { lte: now } },
        }),
        this.db.client.invitation.count({
          where: { status: InvitationStatus.REVOKED },
        }),
        this.db.client.invitation.count({
          where: { status: InvitationStatus.SUPERSEDED },
        }),
      ]);
    return { total, pending, accepted, expired, revoked, superseded };
  }
}
