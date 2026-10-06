import { Injectable } from '@nestjs/common';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import {
  type IncidentRecipients,
  SafetyDirectory,
} from '../domain/notification';

/** Accounts that can still be reached: not deleted, not suspended. */
const REACHABLE = { deletedAt: null, suspendedAt: null } as const;

/**
 * Read model over profiles and families. Kept here rather than in those
 * modules so their APIs do not grow safety-specific queries.
 */
@Injectable()
export class PrismaSafetyDirectory extends SafetyDirectory {
  constructor(private readonly db: PrismaTransactionHost) {
    super();
  }

  async recipientsFor(userId: string): Promise<IncidentRecipients> {
    const user = await this.db.client.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        profile: {
          select: {
            emergencyContacts: {
              select: { fullName: true, phoneNumber: true, priority: true },
              orderBy: { priority: 'asc' },
            },
          },
        },
        familyMembership: { select: { familyId: true, shareIncidents: true } },
      },
    });
    if (!user)
      return {
        driver: { firstName: '', lastName: '' },
        contacts: [],
        family: [],
      };

    const membership = user.familyMembership;
    const family = membership?.shareIncidents
      ? await this.db.client.familyMember.findMany({
          where: {
            familyId: membership.familyId,
            userId: { not: userId },
            user: REACHABLE,
          },
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        })
      : [];

    return {
      driver: { firstName: user.firstName, lastName: user.lastName },
      contacts: user.profile?.emergencyContacts ?? [],
      family: family.map(({ user: member }) => ({
        userId: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
      })),
    };
  }

  async peersSharingIncidents(
    viewerId: string,
  ): Promise<{ userId: string; firstName: string; lastName: string }[]> {
    const viewer = await this.db.client.familyMember.findUnique({
      where: { userId: viewerId },
      select: { familyId: true },
    });
    if (!viewer) return [];
    const peers = await this.db.client.familyMember.findMany({
      where: {
        familyId: viewer.familyId,
        userId: { not: viewerId },
        shareIncidents: true,
        user: { deletedAt: null },
      },
      select: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    });
    return peers.map(({ user }) => ({
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    }));
  }
}
