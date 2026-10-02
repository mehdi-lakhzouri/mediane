import type { EmergencyContact, Gender } from './emergency-contact';
import { MIN_EMERGENCY_CONTACTS } from './profile-rules';

export interface UserProfileProps {
  id: string;
  userId: string;
  phoneNumber: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  /** Storage key of the processed avatar, never a URL. */
  avatarKey: string | null;
  avatarUpdatedAt: Date | null;
  /** Sorted by priority (1 first). */
  emergencyContacts: readonly EmergencyContact[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Driver profile. Contains personal data: never log it, never put it in JWTs or
 * audit metadata. Medical data, when added, belongs in its own bounded context
 * with stricter access rules.
 */
export class UserProfile {
  private constructor(private readonly props: UserProfileProps) {}

  static rehydrate(props: UserProfileProps): UserProfile {
    return new UserProfile(props);
  }

  get userId(): string {
    return this.props.userId;
  }

  get avatarKey(): string | null {
    return this.props.avatarKey;
  }

  /**
   * Completion rule used to set User.profileCompletedAt. The avatar is
   * optional and never part of it.
   */
  isComplete(): boolean {
    return (
      this.props.phoneNumber !== null &&
      this.props.dateOfBirth !== null &&
      this.props.gender !== null &&
      this.props.emergencyContacts.length >= MIN_EMERGENCY_CONTACTS
    );
  }

  toSnapshot(): Readonly<UserProfileProps> {
    return { ...this.props };
  }
}
