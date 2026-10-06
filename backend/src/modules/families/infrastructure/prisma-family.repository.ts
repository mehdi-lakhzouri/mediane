import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { isUniqueConstraintViolation } from '../../../infrastructure/prisma/prisma-errors';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import {
  FamilyPolicy,
  FamilyRole,
  FamilySharing,
  JoinRequestStatus,
} from '../domain/family';
import {
  AlreadyInFamilyError,
  JoinRequestAlreadyPendingError,
} from '../domain/family.errors';
import {
  AdminFamilyStatsRecord,
  FamilyListFilter,
  FamilyMemberRecord,
  FamilyRecord,
  FamilyRepository,
  FamilySummaryRecord,
  JoinRequestRecord,
} from '../domain/family.repository';

const FAMILY_FIELDS = {
  id: true,
  name: true,
  inviteCode: true,
  inviteCodeExpiresAt: true,
  createdAt: true,
} as const;

const MEMBER_INCLUDE = {
  user: { select: { firstName: true, lastName: true } },
} as const;

const REQUEST_INCLUDE = {
  user: { select: { firstName: true, lastName: true } },
  family: { select: { name: true } },
} as const;

type MemberRow = Prisma.FamilyMemberGetPayload<{
  include: typeof MEMBER_INCLUDE;
}>;
type RequestRow = Prisma.FamilyJoinRequestGetPayload<{
  include: typeof REQUEST_INCLUDE;
}>;

function toMember(row: MemberRow): FamilyMemberRecord {
  return {
    familyId: row.familyId,
    userId: row.userId,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    role: row.role,
    joinedAt: row.joinedAt,
    sharing: {
      phone: row.sharePhone,
      incidents: row.shareIncidents,
      health: row.shareHealth,
    },
  };
}

function toRequest(row: RequestRow): JoinRequestRecord {
  return {
    id: row.id,
    familyId: row.familyId,
    familyName: row.family.name,
    userId: row.userId,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class PrismaFamilyRepository implements FamilyRepository {
  constructor(private readonly db: PrismaTransactionHost) {}

  findFamily(familyId: string): Promise<FamilyRecord | null> {
    return this.db.client.family.findUnique({
      where: { id: familyId },
      select: FAMILY_FIELDS,
    });
  }

  async lockFamily(familyId: string): Promise<FamilyRecord | null> {
    const locked = await this.db.client.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "families" WHERE "id" = ${familyId}::uuid FOR UPDATE`;
    return locked.length ? this.findFamily(familyId) : null;
  }

  findByInviteCode(code: string): Promise<FamilyRecord | null> {
    return this.db.client.family.findUnique({
      where: { inviteCode: code },
      select: FAMILY_FIELDS,
    });
  }

  async findMembership(userId: string): Promise<FamilyMemberRecord | null> {
    const row = await this.db.client.familyMember.findUnique({
      where: { userId },
      include: MEMBER_INCLUDE,
    });
    return row ? toMember(row) : null;
  }

  async listMembers(familyId: string): Promise<FamilyMemberRecord[]> {
    const rows = await this.db.client.familyMember.findMany({
      where: { familyId },
      include: MEMBER_INCLUDE,
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toMember);
  }

  countMembers(familyId: string): Promise<number> {
    return this.db.client.familyMember.count({ where: { familyId } });
  }

  async createFamily(data: {
    name: string;
    ownerId: string;
  }): Promise<FamilyRecord> {
    try {
      return await this.db.client.family.create({
        data: {
          name: data.name,
          members: {
            create: { userId: data.ownerId, role: FamilyRole.OWNER },
          },
        },
        select: FAMILY_FIELDS,
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new AlreadyInFamilyError();
      throw error;
    }
  }

  async renameFamily(familyId: string, name: string): Promise<void> {
    await this.db.client.family.update({
      where: { id: familyId },
      data: { name },
    });
  }

  async deleteFamily(familyId: string): Promise<void> {
    await this.db.client.family.delete({ where: { id: familyId } });
  }

  async setInviteCode(
    familyId: string,
    code: string,
    expiresAt: Date,
  ): Promise<boolean> {
    try {
      await this.db.client.family.update({
        where: { id: familyId },
        data: { inviteCode: code, inviteCodeExpiresAt: expiresAt },
      });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  async addMember(
    familyId: string,
    userId: string,
    role: FamilyRole,
  ): Promise<void> {
    try {
      await this.db.client.familyMember.create({
        data: { familyId, userId, role },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new AlreadyInFamilyError('driver');
      }
      throw error;
    }
  }

  async removeMember(userId: string): Promise<void> {
    await this.db.client.familyMember.deleteMany({ where: { userId } });
  }

  async setRole(userId: string, role: FamilyRole): Promise<void> {
    await this.db.client.familyMember.update({
      where: { userId },
      data: { role },
    });
  }

  async updateSharing(
    userId: string,
    sharing: Partial<FamilySharing>,
    now: Date,
  ): Promise<void> {
    const data: Prisma.FamilyMemberUpdateInput = {};
    if (sharing.phone !== undefined) {
      data.sharePhone = sharing.phone;
      data.sharePhoneAt = sharing.phone ? now : null;
    }
    if (sharing.incidents !== undefined) {
      data.shareIncidents = sharing.incidents;
      data.shareIncidentsAt = sharing.incidents ? now : null;
    }
    if (sharing.health !== undefined) {
      data.shareHealth = sharing.health;
      data.shareHealthAt = sharing.health ? now : null;
    }
    await this.db.client.familyMember.update({ where: { userId }, data });
  }

  async createJoinRequest(data: {
    familyId: string;
    userId: string;
    expiresAt: Date;
  }): Promise<JoinRequestRecord> {
    try {
      const row = await this.db.client.familyJoinRequest.create({
        data,
        include: REQUEST_INCLUDE,
      });
      return toRequest(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new JoinRequestAlreadyPendingError();
      }
      throw error;
    }
  }

  async findJoinRequest(requestId: string): Promise<JoinRequestRecord | null> {
    const row = await this.db.client.familyJoinRequest.findUnique({
      where: { id: requestId },
      include: REQUEST_INCLUDE,
    });
    return row ? toRequest(row) : null;
  }

  async findPendingRequestOfUser(
    userId: string,
  ): Promise<JoinRequestRecord | null> {
    const row = await this.db.client.familyJoinRequest.findFirst({
      where: { userId, status: JoinRequestStatus.PENDING },
      include: REQUEST_INCLUDE,
    });
    return row ? toRequest(row) : null;
  }

  async listPendingRequests(familyId: string): Promise<JoinRequestRecord[]> {
    const rows = await this.db.client.familyJoinRequest.findMany({
      where: { familyId, status: JoinRequestStatus.PENDING },
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRequest);
  }

  countPendingRequests(familyId: string): Promise<number> {
    return this.db.client.familyJoinRequest.count({
      where: { familyId, status: JoinRequestStatus.PENDING },
    });
  }

  async closeJoinRequest(
    requestId: string,
    status: JoinRequestStatus,
    decidedById: string | null,
    now: Date,
  ): Promise<boolean> {
    const { count } = await this.db.client.familyJoinRequest.updateMany({
      where: { id: requestId, status: JoinRequestStatus.PENDING },
      data: { status, decidedById, decidedAt: now },
    });
    return count === 1;
  }

  async cancelPendingRequestsOfUser(userId: string, now: Date): Promise<void> {
    await this.db.client.familyJoinRequest.updateMany({
      where: { userId, status: JoinRequestStatus.PENDING },
      data: { status: JoinRequestStatus.CANCELLED, decidedAt: now },
    });
  }

  async expireStaleRequests(now: Date): Promise<void> {
    await this.db.client.familyJoinRequest.updateMany({
      where: { status: JoinRequestStatus.PENDING, expiresAt: { lte: now } },
      data: { status: JoinRequestStatus.EXPIRED, decidedAt: now },
    });
  }

  async listFamilies(
    filter: FamilyListFilter,
  ): Promise<{ items: FamilySummaryRecord[]; totalItems: number }> {
    const search = filter.search?.trim();
    const where: Prisma.FamilyWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            {
              members: {
                some: {
                  user: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          ],
        }
      : {};
    const [rows, totalItems] = await Promise.all([
      this.db.client.family.findMany({
        where,
        select: {
          ...FAMILY_FIELDS,
          _count: { select: { members: true } },
          members: {
            where: { role: FamilyRole.OWNER },
            include: MEMBER_INCLUDE,
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.db.client.family.count({ where }),
    ]);
    return {
      totalItems,
      items: rows.map((row) => {
        const owner = row.members[0];
        return {
          id: row.id,
          name: row.name,
          inviteCode: row.inviteCode,
          inviteCodeExpiresAt: row.inviteCodeExpiresAt,
          createdAt: row.createdAt,
          memberCount: row._count.members,
          owner: owner
            ? {
                userId: owner.userId,
                firstName: owner.user.firstName,
                lastName: owner.user.lastName,
              }
            : null,
        };
      }),
    };
  }

  async getAdminStats(now: Date): Promise<AdminFamilyStatsRecord> {
    const [totalFamilies, totalMembers, pendingRequests, membersByFamily] =
      await Promise.all([
        this.db.client.family.count(),
        this.db.client.familyMember.count(),
        this.db.client.familyJoinRequest.count({
          where: {
            status: JoinRequestStatus.PENDING,
            expiresAt: { gt: now },
          },
        }),
        this.db.client.familyMember.groupBy({
          by: ['familyId'],
          _count: { _all: true },
        }),
      ]);

    return {
      totalFamilies,
      totalMembers,
      pendingRequests,
      fullFamilies: membersByFamily.filter(
        (family) => family._count._all >= FamilyPolicy.MAX_MEMBERS,
      ).length,
    };
  }
}
