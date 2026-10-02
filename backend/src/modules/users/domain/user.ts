import { Email } from '../../../common/domain/email';
import { AccountState, deriveAccountState } from './account-state';
import { Role } from './role';
import { UserStatus } from './user-status';

export interface UserProps {
  id: string;
  email: Email;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt: Date | null;
  passwordChangedAt: Date | null;
  emailVerifiedAt: Date | null;
  profileCompletedAt: Date | null;
  mfaEnabledAt: Date | null;
  lastLoginAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Data required to persist a brand-new user (the id is assigned by persistence). */
export type NewUserData = Omit<UserProps, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * User aggregate root. State transitions (suspend, softDelete, restore,
 * completePasswordChange...) will be added as methods enforcing invariants
 * when the corresponding use cases are implemented.
 */
export class User {
  private constructor(private readonly props: UserProps) {}

  static rehydrate(props: UserProps): User {
    return new User(props);
  }

  /** First administrator, created from the CLI with a password chosen by the operator. */
  static newBootstrapAdmin(params: {
    email: Email;
    firstName: string;
    lastName: string;
    passwordHash: string;
    now: Date;
  }): NewUserData {
    return {
      email: params.email,
      passwordHash: params.passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      firstName: params.firstName.trim(),
      lastName: params.lastName.trim(),
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      passwordChangedAt: params.now,
      emailVerifiedAt: params.now,
      profileCompletedAt: params.now,
      // MFA is set up at first sign-in (MFA_SETUP_REQUIRED for administrators).
      mfaEnabledAt: null,
      lastLoginAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      suspendedAt: null,
      deletedAt: null,
      createdById: null,
    };
  }

  /**
   * A user created by an administrator. Starts INVITED with a temporary
   * password that must be changed; the account only becomes usable once the
   * invitation is accepted.
   */
  static newInvitedUser(params: {
    email: Email;
    firstName: string;
    lastName: string;
    role: Role;
    passwordHash: string;
    temporaryPasswordExpiresAt: Date;
    createdById: string;
  }): NewUserData {
    return {
      email: params.email,
      passwordHash: params.passwordHash,
      role: params.role,
      status: UserStatus.INVITED,
      firstName: params.firstName.trim(),
      lastName: params.lastName.trim(),
      mustChangePassword: true,
      temporaryPasswordExpiresAt: params.temporaryPasswordExpiresAt,
      passwordChangedAt: null,
      emailVerifiedAt: null,
      profileCompletedAt: null,
      mfaEnabledAt: null,
      lastLoginAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      suspendedAt: null,
      deletedAt: null,
      createdById: params.createdById,
    };
  }

  get id(): string {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get role(): Role {
    return this.props.role;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get firstName(): string {
    return this.props.firstName;
  }

  get lastName(): string {
    return this.props.lastName;
  }

  get mustChangePassword(): boolean {
    return this.props.mustChangePassword;
  }

  get temporaryPasswordExpiresAt(): Date | null {
    return this.props.temporaryPasswordExpiresAt;
  }

  get lockedUntil(): Date | null {
    return this.props.lockedUntil;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get profileCompletedAt(): Date | null {
    return this.props.profileCompletedAt;
  }

  get mfaEnabledAt(): Date | null {
    return this.props.mfaEnabledAt;
  }

  /** A second factor is configured: login needs a code after the password. */
  get hasMfa(): boolean {
    return this.props.mfaEnabledAt !== null;
  }

  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  /** Temporary login lock after too many failed attempts. */
  isLocked(now: Date): boolean {
    return this.props.lockedUntil !== null && this.props.lockedUntil > now;
  }

  /** A temporary password stops being accepted once its validity window has passed. */
  isTemporaryPasswordExpired(now: Date): boolean {
    return (
      this.props.mustChangePassword &&
      this.props.temporaryPasswordExpiresAt !== null &&
      this.props.temporaryPasswordExpiresAt <= now
    );
  }

  get accountState(): AccountState {
    return deriveAccountState(this.props);
  }

  /** Read-only copy for mappers/serializers. */
  toSnapshot(): Readonly<UserProps> {
    return { ...this.props };
  }
}
