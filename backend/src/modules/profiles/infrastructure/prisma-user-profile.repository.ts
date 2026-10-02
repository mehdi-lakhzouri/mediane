import { Injectable } from '@nestjs/common';
import type {
  EmergencyContact as EmergencyContactRecord,
  UserProfile as UserProfileRecord,
} from '../../../generated/prisma/client';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import type { ProfileDetails } from '../domain/profile-rules';
import { UserProfile } from '../domain/user-profile';
import { UserProfileRepository } from '../domain/user-profile.repository';

type ProfileRow = UserProfileRecord & {
  emergencyContacts: EmergencyContactRecord[];
};

const WITH_CONTACTS = {
  emergencyContacts: { orderBy: { priority: 'asc' } },
} as const;

function toDomain(row: ProfileRow): UserProfile {
  return UserProfile.rehydrate({
    id: row.id,
    userId: row.userId,
    phoneNumber: row.phoneNumber,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    avatarKey: row.avatarKey,
    avatarUpdatedAt: row.avatarUpdatedAt,
    emergencyContacts: row.emergencyContacts.map((contact) => ({
      fullName: contact.fullName,
      relationship: contact.relationship,
      phoneNumber: contact.phoneNumber,
      priority: contact.priority,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepository {
  constructor(private readonly db: PrismaTransactionHost) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const row = await this.db.client.userProfile.findUnique({
      where: { userId },
      include: WITH_CONTACTS,
    });
    return row ? toDomain(row) : null;
  }

  async findByUserIds(userIds: readonly string[]): Promise<UserProfile[]> {
    if (!userIds.length) return [];
    const rows = await this.db.client.userProfile.findMany({
      where: { userId: { in: [...userIds] } },
      include: WITH_CONTACTS,
    });
    return rows.map(toDomain);
  }

  async saveDetails(
    userId: string,
    details: ProfileDetails,
  ): Promise<UserProfile> {
    const fields = {
      phoneNumber: details.phoneNumber,
      dateOfBirth: details.dateOfBirth,
      gender: details.gender,
    };
    const profile = await this.db.client.userProfile.upsert({
      where: { userId },
      create: { userId, ...fields },
      update: fields,
      select: { id: true },
    });
    // Full replacement: the submitted list IS the new ordered list.
    await this.db.client.emergencyContact.deleteMany({
      where: { profileId: profile.id },
    });
    await this.db.client.emergencyContact.createMany({
      data: details.emergencyContacts.map((contact) => ({
        profileId: profile.id,
        fullName: contact.fullName,
        relationship: contact.relationship,
        phoneNumber: contact.phoneNumber,
        priority: contact.priority,
      })),
    });
    const row = await this.db.client.userProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: WITH_CONTACTS,
    });
    return toDomain(row);
  }

  async replaceAvatar(
    userId: string,
    avatarKey: string | null,
    now: Date,
  ): Promise<string | null> {
    // Row lock until commit: two uploads in parallel cannot both read the same
    // "previous" key and leave an orphaned object behind.
    const locked = await this.db.client.$queryRaw<
      { avatarKey: string | null }[]
    >`SELECT "avatarKey" FROM "user_profiles" WHERE "userId" = ${userId}::uuid FOR UPDATE`;

    const fields = {
      avatarKey,
      avatarUpdatedAt: avatarKey ? now : null,
    };
    await this.db.client.userProfile.upsert({
      where: { userId },
      create: { userId, ...fields },
      update: fields,
      select: { id: true },
    });
    return locked[0]?.avatarKey ?? null;
  }
}
