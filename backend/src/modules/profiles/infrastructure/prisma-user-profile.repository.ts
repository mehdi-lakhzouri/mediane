import { Injectable } from '@nestjs/common';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import { UserProfile } from '../domain/user-profile';
import { UserProfileRepository } from '../domain/user-profile.repository';

@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepository {
  constructor(private readonly db: PrismaTransactionHost) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const record = await this.db.client.userProfile.findUnique({
      where: { userId },
    });
    return record ? UserProfile.rehydrate(record) : null;
  }
}
