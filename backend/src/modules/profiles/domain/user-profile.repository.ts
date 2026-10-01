import { UserProfile } from './user-profile';

/** Port. Upsert is added with the profile-completion use case. */
export abstract class UserProfileRepository {
  abstract findByUserId(userId: string): Promise<UserProfile | null>;
}
