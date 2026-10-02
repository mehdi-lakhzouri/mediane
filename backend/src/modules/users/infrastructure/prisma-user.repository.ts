import { Injectable } from '@nestjs/common';
import { Email } from '../../../common/domain/email';
import type { Prisma } from '../../../generated/prisma/client';
import { isUniqueConstraintViolation } from '../../../infrastructure/prisma/prisma-errors';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import { Role } from '../domain/role';
import { NewUserData, User } from '../domain/user';
import { UserStatus } from '../domain/user-status';
import { EmailAlreadyInUseError } from '../domain/user.errors';
import {
  ListUsersFilter,
  UserIdentityPatch,
  UserPage,
  UserRepository,
} from '../domain/user.repository';
import { toDomainUser } from './user.mapper';

const NOT_DELETED = { deletedAt: null };

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaTransactionHost) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.db.client.user.findFirst({
      where: { id, ...NOT_DELETED },
    });
    return record ? toDomainUser(record) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const record = await this.db.client.user.findFirst({
      where: { email: email.value, ...NOT_DELETED },
    });
    return record ? toDomainUser(record) : null;
  }

  async findByIdIncludingDeleted(id: string): Promise<User | null> {
    const record = await this.db.client.user.findUnique({ where: { id } });
    return record ? toDomainUser(record) : null;
  }

  async existsByEmailIncludingDeleted(email: Email): Promise<boolean> {
    const count = await this.db.client.user.count({
      where: { email: email.value },
    });
    return count > 0;
  }

  async existsActiveAdmin(): Promise<boolean> {
    const count = await this.db.client.user.count({
      where: { role: Role.ADMIN, ...NOT_DELETED },
    });
    return count > 0;
  }

  async list(filter: ListUsersFilter): Promise<UserPage> {
    const search = filter.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(filter.includeDeleted ? {} : NOT_DELETED),
      ...(filter.role ? { role: filter.role } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [records, totalItems] = await Promise.all([
      this.db.client.user.findMany({
        where,
        // Secondary key keeps paging stable when the primary key ties.
        orderBy: [
          { [filter.sortBy ?? 'createdAt']: filter.sortDir ?? 'desc' },
          { id: 'desc' },
        ],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.db.client.user.count({ where }),
    ]);

    return { items: records.map(toDomainUser), totalItems };
  }

  async create(data: NewUserData): Promise<User> {
    try {
      const record = await this.db.client.user.create({
        data: { ...data, email: data.email.value },
      });
      return toDomainUser(record);
    } catch (error) {
      if (isUniqueConstraintViolation(error))
        throw new EmailAlreadyInUseError();
      throw error;
    }
  }

  async updateIdentity(
    userId: string,
    patch: UserIdentityPatch,
  ): Promise<User> {
    const record = await this.db.client.user.update({
      where: { id: userId },
      data: patch,
    });
    return toDomainUser(record);
  }

  async setSuspended(
    userId: string,
    suspended: boolean,
    now: Date,
  ): Promise<User> {
    const record = await this.db.client.user.update({
      where: { id: userId },
      data: suspended
        ? { status: UserStatus.SUSPENDED, suspendedAt: now }
        : { status: UserStatus.ACTIVE, suspendedAt: null },
    });
    return toDomainUser(record);
  }

  async softDelete(userId: string, now: Date): Promise<User> {
    const record = await this.db.client.user.update({
      where: { id: userId },
      data: { deletedAt: now },
    });
    return toDomainUser(record);
  }

  async restore(userId: string): Promise<User> {
    const record = await this.db.client.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });
    return toDomainUser(record);
  }

  async hardDelete(userId: string): Promise<void> {
    await this.db.client.user.delete({ where: { id: userId } });
  }

  async incrementFailedLoginAttempts(userId: string): Promise<number> {
    const { failedLoginAttempts } = await this.db.client.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    return failedLoginAttempts;
  }

  async lockLogin(userId: string, until: Date): Promise<void> {
    await this.db.client.user.update({
      where: { id: userId },
      data: { lockedUntil: until, failedLoginAttempts: 0 },
    });
  }

  async recordSuccessfulLogin(
    userId: string,
    now: Date,
    upgradedPasswordHash: string | null,
  ): Promise<void> {
    await this.db.client.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(upgradedPasswordHash ? { passwordHash: upgradedPasswordHash } : {}),
      },
    });
  }

  async activateInvitedUser(userId: string, now: Date): Promise<boolean> {
    const { count } = await this.db.client.user.updateMany({
      where: { id: userId, status: UserStatus.INVITED, deletedAt: null },
      data: { status: UserStatus.ACTIVE, emailVerifiedAt: now },
    });
    return count === 1;
  }

  async markProfileCompleted(userId: string, now: Date): Promise<boolean> {
    const { count } = await this.db.client.user.updateMany({
      where: { id: userId, profileCompletedAt: null, deletedAt: null },
      data: { profileCompletedAt: now },
    });
    return count === 1;
  }

  async setTemporaryPassword(
    userId: string,
    passwordHash: string,
    expiresAt: Date,
  ): Promise<User> {
    const record = await this.db.client.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        temporaryPasswordExpiresAt: expiresAt,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    return toDomainUser(record);
  }

  async setPassword(
    userId: string,
    passwordHash: string,
    now: Date,
  ): Promise<User> {
    const record = await this.db.client.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: now,
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    return toDomainUser(record);
  }
}
