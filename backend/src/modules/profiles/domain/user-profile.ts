export interface UserProfileProps {
  id: string;
  userId: string;
  phoneNumber: string | null;
  dateOfBirth: Date | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
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

  /** Completion rule used to set User.profileCompletedAt. */
  isComplete(): boolean {
    return (
      this.props.phoneNumber !== null &&
      this.props.dateOfBirth !== null &&
      this.props.emergencyContactName !== null &&
      this.props.emergencyContactPhone !== null
    );
  }

  toSnapshot(): Readonly<UserProfileProps> {
    return { ...this.props };
  }
}
