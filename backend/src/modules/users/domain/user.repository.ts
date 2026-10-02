import { Email } from '../../../common/domain/email';
import { Role } from './role';
import { NewUserData, User } from './user';
import { UserStatus } from './user-status';

export const USER_SORT_FIELDS = [
  'createdAt',
  'email',
  'lastName',
  'status',
  'lastLoginAt',
] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export interface ListUsersFilter {
  sortBy?: UserSortField;
  sortDir?: SortDirection;
  page: number;
  pageSize: number;
  role?: Role;
  status?: UserStatus;
  /** Case-insensitive match on email, first name or last name. */
  search?: string;
  includeDeleted: boolean;
}

export interface UserPage {
  items: User[];
  totalItems: number;
}

export interface UserIdentityPatch {
  firstName?: string;
  lastName?: string;
}

/**
 * Port. Soft-delete safety: every method EXCLUDES soft-deleted users unless its
 * name says `IncludingDeleted` or the call opts in through a filter. Those
 * variants are reserved for uniqueness checks, restore and hard delete.
 */
export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;

  abstract findByEmail(email: Email): Promise<User | null>;

  abstract findByIdIncludingDeleted(id: string): Promise<User | null>;

  abstract existsByEmailIncludingDeleted(email: Email): Promise<boolean>;

  abstract existsActiveAdmin(): Promise<boolean>;

  /** Soft-deleted rows appear only when the filter asks for them. */
  abstract list(filter: ListUsersFilter): Promise<UserPage>;

  /** @throws EmailAlreadyInUseError on unique email violation. */
  abstract create(data: NewUserData): Promise<User>;

  abstract updateIdentity(
    userId: string,
    patch: UserIdentityPatch,
  ): Promise<User>;

  /** Suspends or reactivates. Reactivating returns the user to ACTIVE. */
  abstract setSuspended(
    userId: string,
    suspended: boolean,
    now: Date,
  ): Promise<User>;

  abstract softDelete(userId: string, now: Date): Promise<User>;

  abstract restore(userId: string): Promise<User>;

  /** Irreversible. Cascades to profile, sessions and tokens; audit logs survive. */
  abstract hardDelete(userId: string): Promise<void>;

  /** Atomic increment. Returns the new number of consecutive failures. */
  abstract incrementFailedLoginAttempts(userId: string): Promise<number>;

  /** Locks login until `until` and resets the failure counter. */
  abstract lockLogin(userId: string, until: Date): Promise<void>;

  /** Resets failures/lock, stamps lastLoginAt, optionally stores an upgraded hash. */
  abstract recordSuccessfulLogin(
    userId: string,
    now: Date,
    upgradedPasswordHash: string | null,
  ): Promise<void>;

  /**
   * Moves an INVITED account to ACTIVE and stamps emailVerifiedAt: accepting an
   * invitation proves the address. Returns false if it was no longer INVITED.
   */
  abstract activateInvitedUser(userId: string, now: Date): Promise<boolean>;

  /**
   * Stamps profileCompletedAt once (moves a driver from PROFILE_SETUP_REQUIRED
   * to ACTIVE). Returns false if it was already set: later edits keep the
   * original completion date.
   */
  abstract markProfileCompleted(userId: string, now: Date): Promise<boolean>;

  /**
   * Replaces the credential with a fresh temporary one (invitation resend).
   * Unlike setPassword it keeps `mustChangePassword` on, so the driver is still
   * forced to choose their own password at next sign-in.
   */
  abstract setTemporaryPassword(
    userId: string,
    passwordHash: string,
    expiresAt: Date,
  ): Promise<User>;

  /**
   * Sets a password chosen by the user: clears the temporary-password state
   * (mustChangePassword, temporaryPasswordExpiresAt) and any login lock.
   */
  abstract setPassword(
    userId: string,
    passwordHash: string,
    now: Date,
  ): Promise<User>;
}
