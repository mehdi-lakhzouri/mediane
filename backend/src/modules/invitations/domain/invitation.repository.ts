import { Invitation } from './invitation';
import type { EffectiveInvitationStatus } from './invitation';
import type { Role } from '../../users/domain/role';
import type { UserStatus } from '../../users/domain/user-status';

export interface NewInvitationData {
  userId: string;
  invitedById: string;
  /** HMAC of the raw token. The raw token only ever exists in the email link. */
  tokenHash: string;
  expiresAt: Date;
}

export const INVITATION_SORT_FIELDS = [
  'createdAt',
  'expiresAt',
  'status',
  'email',
] as const;
export type InvitationSortField = (typeof INVITATION_SORT_FIELDS)[number];

export interface AdminInvitationListFilter {
  page: number;
  pageSize: number;
  search?: string;
  status?: EffectiveInvitationStatus;
  role?: Role;
  sortBy?: InvitationSortField;
  sortDir?: 'asc' | 'desc';
}

export interface AdminInvitationRecord {
  invitationId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  userStatus: UserStatus;
  userDeletedAt: Date | null;
  status: EffectiveInvitationStatus;
  invitedBy: {
    userId: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

export interface AdminInvitationStatsRecord {
  total: number;
  pending: number;
  accepted: number;
  expired: number;
  revoked: number;
  superseded: number;
}

/**
 * Port. Lookups by token always take the HASH (the raw token never reaches
 * persistence).
 */
export abstract class InvitationRepository {
  abstract findByTokenHash(tokenHash: string): Promise<Invitation | null>;

  abstract findLatestForUser(userId: string): Promise<Invitation | null>;

  abstract create(data: NewInvitationData): Promise<Invitation>;

  /**
   * Marks every still-pending invitation of the user SUPERSEDED, so at most one
   * can be accepted. Returns how many were superseded.
   */
  abstract supersedePendingForUser(userId: string, now: Date): Promise<number>;

  /**
   * Revokes the invitation if it is still pending. Returns false when it was
   * already accepted, revoked or superseded.
   */
  /**
   * Consumes the invitation in one conditional update
   * (`tokenHash` + PENDING + not expired). Returns null when it was already
   * accepted, revoked, superseded or has expired, so two concurrent replays of
   * the same link can never both succeed.
   */
  abstract accept(
    tokenHash: string,
    now: Date,
  ): Promise<{ invitationId: string; userId: string } | null>;

  abstract revoke(
    invitationId: string,
    revokedById: string,
    now: Date,
  ): Promise<boolean>;

  abstract adminList(
    filter: AdminInvitationListFilter,
    now: Date,
  ): Promise<{ items: AdminInvitationRecord[]; totalItems: number }>;

  abstract adminStats(now: Date): Promise<AdminInvitationStatsRecord>;
}
