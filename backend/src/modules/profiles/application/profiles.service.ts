import { Injectable } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { notImplemented } from '../../../common/errors';

export interface ProfileData {
  phoneNumber: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface ProfileView extends ProfileData {
  completedAt: Date | null;
}

/**
 * Self-service profile (implementation deferred). Always scoped to the caller's
 * own userId (taken from the session, never from the request). Completing the
 * profile sets User.profileCompletedAt in the same transaction, which moves the
 * account from PROFILE_SETUP_REQUIRED to ACTIVE.
 */
@Injectable()
export class ProfilesService {
  getOwnProfile(_userId: string): Promise<ProfileView> {
    return notImplemented('profiles.getOwnProfile');
  }

  saveOwnProfile(
    _userId: string,
    _data: ProfileData,
    _client: ClientContext,
  ): Promise<ProfileView> {
    return notImplemented('profiles.saveOwnProfile');
  }
}
