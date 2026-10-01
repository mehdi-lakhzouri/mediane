import { Email } from '../../../common/domain/email';
import type { User as UserRecord } from '../../../generated/prisma/client';
import { User } from '../domain/user';

export function toDomainUser(record: UserRecord): User {
  return User.rehydrate({
    id: record.id,
    email: Email.create(record.email),
    passwordHash: record.passwordHash,
    role: record.role,
    status: record.status,
    firstName: record.firstName,
    lastName: record.lastName,
    mustChangePassword: record.mustChangePassword,
    temporaryPasswordExpiresAt: record.temporaryPasswordExpiresAt,
    passwordChangedAt: record.passwordChangedAt,
    emailVerifiedAt: record.emailVerifiedAt,
    profileCompletedAt: record.profileCompletedAt,
    lastLoginAt: record.lastLoginAt,
    failedLoginAttempts: record.failedLoginAttempts,
    lockedUntil: record.lockedUntil,
    suspendedAt: record.suspendedAt,
    deletedAt: record.deletedAt,
    createdById: record.createdById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
