import type { ProfileDetails } from './profile-rules';
import { UserProfile } from './user-profile';

/** Port. Always addressed by the owner's userId (one profile per user). */
export abstract class UserProfileRepository {
  abstract findByUserId(userId: string): Promise<UserProfile | null>;

  /**
   * Creates or updates the profile and REPLACES its emergency contacts with
   * `details.emergencyContacts`. Must run inside a UnitOfWork.
   */
  abstract saveDetails(
    userId: string,
    details: ProfileDetails,
  ): Promise<UserProfile>;

  /**
   * Points the profile at a new avatar (or none), creating the profile row if
   * needed. Locks the row, so concurrent uploads are serialized. Returns the
   * previous key so the caller can delete that object after commit.
   * Must run inside a UnitOfWork.
   */
  abstract replaceAvatar(
    userId: string,
    avatarKey: string | null,
    now: Date,
  ): Promise<string | null>;
}
