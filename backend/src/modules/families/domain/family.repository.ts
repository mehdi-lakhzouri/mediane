import type { FamilyRole, FamilySharing, JoinRequestStatus } from './family';

export interface FamilyRecord {
  id: string;
  name: string;
  inviteCode: string | null;
  inviteCodeExpiresAt: Date | null;
  createdAt: Date;
}

export interface FamilyMemberRecord {
  familyId: string;
  userId: string;
  firstName: string;
  lastName: string;
  role: FamilyRole;
  joinedAt: Date;
  sharing: FamilySharing;
}

export interface JoinRequestRecord {
  id: string;
  familyId: string;
  familyName: string;
  userId: string;
  firstName: string;
  lastName: string;
  status: JoinRequestStatus;
  expiresAt: Date;
  createdAt: Date;
}

export interface FamilySummaryRecord extends FamilyRecord {
  memberCount: number;
  owner: { userId: string; firstName: string; lastName: string } | null;
}

export interface FamilyListFilter {
  page: number;
  pageSize: number;
  /** Matches the family name or a member's name/email. */
  search?: string;
}

/**
 * Port. Methods that read-then-write must run inside a UnitOfWork, after
 * `lockFamily`, so capacity and ownership checks cannot race.
 */
export abstract class FamilyRepository {
  abstract findFamily(familyId: string): Promise<FamilyRecord | null>;

  /** SELECT ... FOR UPDATE: serializes membership changes of one family. */
  abstract lockFamily(familyId: string): Promise<FamilyRecord | null>;

  abstract findByInviteCode(code: string): Promise<FamilyRecord | null>;

  abstract findMembership(userId: string): Promise<FamilyMemberRecord | null>;

  /** Ordered by join date, oldest first. */
  abstract listMembers(familyId: string): Promise<FamilyMemberRecord[]>;

  abstract countMembers(familyId: string): Promise<number>;

  /**
   * Creates the family with its owner as first member (no invite code yet).
   * @throws AlreadyInFamilyError if the owner joined another family meanwhile.
   */
  abstract createFamily(data: {
    name: string;
    ownerId: string;
  }): Promise<FamilyRecord>;

  abstract renameFamily(familyId: string, name: string): Promise<void>;

  /** Cascades to members and join requests. */
  abstract deleteFamily(familyId: string): Promise<void>;

  /** @returns false on a code collision (unique), so the caller retries. */
  abstract setInviteCode(
    familyId: string,
    code: string,
    expiresAt: Date,
  ): Promise<boolean>;

  /** @throws AlreadyInFamilyError (one family per driver, unique userId). */
  abstract addMember(
    familyId: string,
    userId: string,
    role: FamilyRole,
  ): Promise<void>;

  abstract removeMember(userId: string): Promise<void>;

  abstract setRole(userId: string, role: FamilyRole): Promise<void>;

  /** Turning a flag on stamps its consent time; turning it off clears it. */
  abstract updateSharing(
    userId: string,
    sharing: Partial<FamilySharing>,
    now: Date,
  ): Promise<void>;

  /** @throws JoinRequestAlreadyPendingError (one pending request per driver). */
  abstract createJoinRequest(data: {
    familyId: string;
    userId: string;
    expiresAt: Date;
  }): Promise<JoinRequestRecord>;

  abstract findJoinRequest(
    requestId: string,
  ): Promise<JoinRequestRecord | null>;

  abstract findPendingRequestOfUser(
    userId: string,
  ): Promise<JoinRequestRecord | null>;

  abstract listPendingRequests(familyId: string): Promise<JoinRequestRecord[]>;

  abstract countPendingRequests(familyId: string): Promise<number>;

  /** Conditional on PENDING. @returns false if it was no longer pending. */
  abstract closeJoinRequest(
    requestId: string,
    status: JoinRequestStatus,
    decidedById: string | null,
    now: Date,
  ): Promise<boolean>;

  abstract cancelPendingRequestsOfUser(
    userId: string,
    now: Date,
  ): Promise<void>;

  /** Pending requests past their expiry become EXPIRED. */
  abstract expireStaleRequests(now: Date): Promise<void>;

  abstract listFamilies(
    filter: FamilyListFilter,
  ): Promise<{ items: FamilySummaryRecord[]; totalItems: number }>;
}
