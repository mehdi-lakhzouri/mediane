import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action';
import { FileStorage } from '../../storage/application/file-storage';
import type { AccountState } from '../../users/domain/account-state';
import { UserNotFoundError } from '../../users/domain/user.errors';
import { UserRepository } from '../../users/domain/user.repository';
import type {
  EmergencyContact,
  EmergencyContactRelationship,
  Gender,
} from '../domain/emergency-contact';
import { assertProfileDetails, ProfileDetails } from '../domain/profile-rules';
import { UserProfile } from '../domain/user-profile';
import { UserProfileRepository } from '../domain/user-profile.repository';
import {
  AvatarImageProcessor,
  InvalidAvatarImageError,
} from './avatar-image-processor';

/** Long enough to render a screen, short enough that a leaked link soon dies. */
export const AVATAR_URL_TTL_SECONDS = 10 * 60;

export interface SaveProfileCommand {
  phoneNumber: string;
  /** YYYY-MM-DD (already format-checked). */
  dateOfBirth: string;
  gender: Gender;
  /** In priority order: the first one is called first. */
  emergencyContacts: readonly {
    fullName: string;
    relationship: EmergencyContactRelationship;
    phoneNumber: string;
  }[];
}

export interface ProfileView {
  phoneNumber: string | null;
  /** YYYY-MM-DD */
  dateOfBirth: string | null;
  gender: Gender | null;
  emergencyContacts: EmergencyContact[];
  avatar: { url: string; expiresAt: Date } | null;
  completedAt: Date | null;
  /** Lets the client move on as soon as the profile completes onboarding. */
  accountState: AccountState;
}

function toCalendarDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function fromCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Self-service driver profile. Always scoped to the caller's own userId (taken
 * from the session, never from the request). The first time the profile is
 * complete, User.profileCompletedAt is set in the same transaction, which
 * moves the account from PROFILE_SETUP_REQUIRED to ACTIVE.
 */
@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly profiles: UserProfileRepository,
    private readonly users: UserRepository,
    private readonly images: AvatarImageProcessor,
    private readonly storage: FileStorage,
    private readonly audit: AuditService,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async getOwnProfile(userId: string): Promise<ProfileView> {
    const [user, profile] = await Promise.all([
      this.users.findById(userId),
      this.profiles.findByUserId(userId),
    ]);
    if (!user) throw new UserNotFoundError();
    return {
      ...(await this.describe(profile)),
      completedAt: user.profileCompletedAt,
      accountState: user.accountState,
    };
  }

  async saveOwnProfile(
    userId: string,
    command: SaveProfileCommand,
    client: ClientContext,
  ): Promise<ProfileView> {
    const now = new Date();
    const details: ProfileDetails = {
      phoneNumber: command.phoneNumber,
      dateOfBirth: toCalendarDate(command.dateOfBirth),
      gender: command.gender,
      emergencyContacts: command.emergencyContacts.map((contact, index) => ({
        ...contact,
        priority: index + 1,
      })),
    };
    assertProfileDetails(details, now);

    await this.unitOfWork.run(async () => {
      const profile = await this.profiles.saveDetails(userId, details);
      const firstCompletion =
        profile.isComplete() &&
        (await this.users.markProfileCompleted(userId, now));
      await this.audit.record({
        action: firstCompletion
          ? AuditAction.PROFILE_COMPLETED
          : AuditAction.PROFILE_UPDATED,
        actor: { type: 'USER', userId },
        target: { type: 'USER', id: userId },
        client,
        // Counts only: profile content is personal data and stays out of the audit log.
        metadata: { emergencyContacts: details.emergencyContacts.length },
      });
    });
    return this.getOwnProfile(userId);
  }

  /**
   * The object is stored BEFORE the database points at it, and the old one is
   * deleted only AFTER commit: a failure at any step never leaves the profile
   * pointing at a missing file.
   */
  async updateOwnAvatar(
    userId: string,
    upload: Buffer | undefined,
    client: ClientContext,
  ): Promise<ProfileView> {
    if (!upload?.length) throw new InvalidAvatarImageError('is required');
    const image = await this.images.process(upload);
    const key = `avatars/${randomUUID()}.${image.extension}`;
    await this.storage.put(key, image.data, image.contentType);

    let previousKey: string | null;
    try {
      previousKey = await this.unitOfWork.run(async () => {
        const previous = await this.profiles.replaceAvatar(
          userId,
          key,
          new Date(),
        );
        await this.audit.record({
          action: AuditAction.PROFILE_AVATAR_UPDATED,
          actor: { type: 'USER', userId },
          target: { type: 'USER', id: userId },
          client,
        });
        return previous;
      });
    } catch (error) {
      await this.discard(key);
      throw error;
    }
    if (previousKey) await this.discard(previousKey);
    return this.getOwnProfile(userId);
  }

  async removeOwnAvatar(
    userId: string,
    client: ClientContext,
  ): Promise<ProfileView> {
    const profile = await this.profiles.findByUserId(userId);
    if (profile?.avatarKey) {
      const previousKey = await this.unitOfWork.run(async () => {
        const previous = await this.profiles.replaceAvatar(
          userId,
          null,
          new Date(),
        );
        if (previous) {
          await this.audit.record({
            action: AuditAction.PROFILE_AVATAR_REMOVED,
            actor: { type: 'USER', userId },
            target: { type: 'USER', id: userId },
            client,
          });
        }
        return previous;
      });
      if (previousKey) await this.discard(previousKey);
    }
    return this.getOwnProfile(userId);
  }

  /**
   * For account hard deletion: the database cascade removes the profile row,
   * but the photo lives in object storage. Read the key BEFORE deleting the
   * user, then call deleteStoredAvatar AFTER the deletion committed.
   */
  async findStoredAvatarKey(userId: string): Promise<string | null> {
    return (await this.profiles.findByUserId(userId))?.avatarKey ?? null;
  }

  deleteStoredAvatar(key: string): Promise<void> {
    return this.discard(key);
  }

  private async describe(
    profile: UserProfile | null,
  ): Promise<Omit<ProfileView, 'completedAt' | 'accountState'>> {
    const snapshot = profile?.toSnapshot();
    return {
      phoneNumber: snapshot?.phoneNumber ?? null,
      dateOfBirth: snapshot?.dateOfBirth
        ? fromCalendarDate(snapshot.dateOfBirth)
        : null,
      gender: snapshot?.gender ?? null,
      emergencyContacts: [...(snapshot?.emergencyContacts ?? [])],
      avatar: snapshot?.avatarKey
        ? await this.storage.signedDownloadUrl(
            snapshot.avatarKey,
            AVATAR_URL_TTL_SECONDS,
          )
        : null,
    };
  }

  /** Best effort, after commit: a leftover object is garbage, never a broken profile. */
  private async discard(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (err) {
      this.logger.warn({ err, key }, 'Stored file could not be deleted');
    }
  }
}
