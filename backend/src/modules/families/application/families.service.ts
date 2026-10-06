import { Inject, Injectable } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { appConfig, type AppConfig } from '../../../config';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { ProfilesService } from '../../profiles/application/profiles.service';
import { AccountState } from '../../users/domain/account-state';
import { Role } from '../../users/domain/role';
import { UserNotFoundError } from '../../users/domain/user.errors';
import { UserRepository } from '../../users/domain/user.repository';
import {
  FamilyPolicy,
  FamilyRole,
  FamilySharing,
  formatInviteCode,
  generateInviteCode,
  isWellFormedInviteCode,
  JoinRequestStatus,
  normalizeInviteCode,
} from '../domain/family';
import {
  AlreadyInFamilyError,
  CannotRemoveYourselfError,
  FamilyFullError,
  FamilyInviteInvalidError,
  FamilyMemberNotFoundError,
  FamilyNotFoundError,
  FamilyOwnerOnlyError,
  JoinRequestClosedError,
  JoinRequestNotFoundError,
  NotADriverError,
  NotInFamilyError,
} from '../domain/family.errors';
import {
  AdminFamilyStatsRecord,
  FamilyListFilter,
  FamilyMemberRecord,
  FamilyRecord,
  FamilyRepository,
  FamilySummaryRecord,
  JoinRequestRecord,
} from '../domain/family.repository';

// ---------------------------------------------------------------- views

type Avatar = { url: string; expiresAt: Date } | null;

export interface FamilyMemberView {
  userId: string;
  firstName: string;
  lastName: string;
  role: FamilyRole;
  joinedAt: Date;
  avatar: Avatar;
  /** Only when that member shares their phone with the family. */
  phoneNumber: string | null;
  sharing: FamilySharing;
}

export interface FamilyView {
  id: string;
  name: string;
  myRole: FamilyRole;
  mySharing: FamilySharing;
  maxMembers: number;
  members: FamilyMemberView[];
  /** Owner only (null for members). */
  pendingRequestCount: number | null;
}

export interface JoinRequestView {
  id: string;
  familyName: string;
  status: JoinRequestStatus;
  createdAt: Date;
  expiresAt: Date;
}

export interface MyFamilyView {
  family: FamilyView | null;
  /** The request waiting for an owner's answer, when not in a family yet. */
  pendingRequest: JoinRequestView | null;
}

export interface FamilyInviteView {
  /** Display form: K7M4-QX9P. */
  code: string;
  /** Shareable https link containing the code. */
  link: string;
  expiresAt: Date;
}

export interface FamilyInvitePreview {
  familyName: string;
  ownerFirstName: string | null;
  memberCount: number;
  maxMembers: number;
  full: boolean;
}

export interface IncomingJoinRequestView {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatar: Avatar;
  createdAt: Date;
  expiresAt: Date;
}

export interface AdminFamilyMemberView {
  userId: string;
  firstName: string;
  lastName: string;
  role: FamilyRole;
  joinedAt: Date;
}

/** Administrators see the composition, never what members share. */
export interface AdminFamilyView {
  id: string;
  name: string;
  createdAt: Date;
  memberCount: number;
  owner: { userId: string; firstName: string; lastName: string } | null;
  members?: AdminFamilyMemberView[];
  pendingRequestCount?: number;
}

export interface AdminFamilyStatsView extends AdminFamilyStatsRecord {
  maxMembersPerFamily: number;
  availableSeats: number;
  averageMembers: number;
}

export interface Actor {
  userId: string;
  client: ClientContext;
}

type DetachReason = 'LEFT' | 'REMOVED';

/**
 * Families of drivers. Rules that must hold under concurrency (capacity,
 * single owner, single family per driver, single pending request) are
 * enforced by row locks and by unique indexes in the database.
 */
@Injectable()
export class FamiliesService {
  constructor(
    private readonly families: FamilyRepository,
    private readonly users: UserRepository,
    private readonly profiles: ProfilesService,
    private readonly audit: AuditService,
    private readonly unitOfWork: UnitOfWork,
    private readonly notifications: NotificationsService,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
  ) {}

  // ------------------------------------------------------------ driver reads

  async getMine(userId: string): Promise<MyFamilyView> {
    const now = new Date();
    const membership = await this.families.findMembership(userId);
    if (membership) {
      return {
        family: await this.describeFor(membership, now),
        pendingRequest: null,
      };
    }
    const pending = await this.families.findPendingRequestOfUser(userId);
    return {
      family: null,
      pendingRequest:
        pending && pending.expiresAt > now ? toRequestView(pending) : null,
    };
  }

  /** What someone holding a code sees before asking to join. */
  async previewInvite(rawCode: string): Promise<FamilyInvitePreview> {
    const family = await this.familyForCode(rawCode, new Date());
    const members = await this.families.listMembers(family.id);
    const owner = members.find((m) => m.role === FamilyRole.OWNER);
    return {
      familyName: family.name,
      ownerFirstName: owner?.firstName ?? null,
      memberCount: members.length,
      maxMembers: FamilyPolicy.MAX_MEMBERS,
      full: members.length >= FamilyPolicy.MAX_MEMBERS,
    };
  }

  // ----------------------------------------------------- driver: lifecycle

  async create(
    userId: string,
    name: string,
    client: ClientContext,
  ): Promise<MyFamilyView> {
    const now = new Date();
    await this.unitOfWork.run(async () => {
      if (await this.families.findMembership(userId)) {
        throw new AlreadyInFamilyError();
      }
      // Starting a family withdraws any request to join another one.
      await this.families.cancelPendingRequestsOfUser(userId, now);
      const family = await this.families.createFamily({
        name,
        ownerId: userId,
      });
      await this.issueInviteCode(family.id, now);
      await this.audit.record({
        action: AuditAction.FAMILY_CREATED,
        actor: { type: 'USER', userId },
        target: { type: 'FAMILY', id: family.id },
        client,
      });
    });
    return this.getMine(userId);
  }

  async rename(
    userId: string,
    name: string,
    client: ClientContext,
  ): Promise<MyFamilyView> {
    const owner = await this.requireOwner(userId);
    await this.families.renameFamily(owner.familyId, name);
    await this.audit.record({
      action: AuditAction.FAMILY_RENAMED,
      actor: { type: 'USER', userId },
      target: { type: 'FAMILY', id: owner.familyId },
      client,
    });
    return this.getMine(userId);
  }

  async dissolve(userId: string, client: ClientContext): Promise<void> {
    const owner = await this.requireOwner(userId);
    await this.dissolveFamily(owner.familyId, { userId, client });
  }

  // ------------------------------------------------- driver: invite & join

  /** The current code, or a new one if there is none or it expired. */
  async getInvite(userId: string): Promise<FamilyInviteView> {
    const owner = await this.requireOwner(userId);
    const now = new Date();
    const family = await this.requireFamily(owner.familyId);
    if (
      family.inviteCode &&
      family.inviteCodeExpiresAt &&
      family.inviteCodeExpiresAt > now
    ) {
      return this.inviteView(family.inviteCode, family.inviteCodeExpiresAt);
    }
    return this.issueInviteCode(owner.familyId, now);
  }

  /** The previous code stops working immediately. */
  async rotateInvite(
    userId: string,
    client: ClientContext,
  ): Promise<FamilyInviteView> {
    const owner = await this.requireOwner(userId);
    const invite = await this.issueInviteCode(owner.familyId, new Date());
    await this.audit.record({
      action: AuditAction.FAMILY_INVITE_ROTATED,
      actor: { type: 'USER', userId },
      target: { type: 'FAMILY', id: owner.familyId },
      client,
    });
    return invite;
  }

  async requestToJoin(
    userId: string,
    rawCode: string,
    client: ClientContext,
  ): Promise<MyFamilyView> {
    const now = new Date();
    const family = await this.familyForCode(rawCode, now);
    await this.unitOfWork.run(async () => {
      await this.families.expireStaleRequests(now);
      if (await this.families.findMembership(userId)) {
        throw new AlreadyInFamilyError();
      }
      if (
        (await this.families.countMembers(family.id)) >=
        FamilyPolicy.MAX_MEMBERS
      ) {
        throw new FamilyFullError();
      }
      const request = await this.families.createJoinRequest({
        familyId: family.id,
        userId,
        expiresAt: new Date(now.getTime() + FamilyPolicy.JOIN_REQUEST_TTL_MS),
      });
      await this.audit.record({
        action: AuditAction.FAMILY_JOIN_REQUESTED,
        actor: { type: 'USER', userId },
        target: { type: 'FAMILY', id: family.id },
        client,
        metadata: { requestId: request.id },
      });
      const owner = (await this.families.listMembers(family.id)).find(
        (m) => m.role === FamilyRole.OWNER,
      );
      if (owner) {
        await this.notifications.notify(owner.userId, {
          type: 'FAMILY_JOIN_REQUESTED',
          requesterName: `${request.firstName} ${request.lastName}`,
        });
      }
    });
    return this.getMine(userId);
  }

  async cancelMyRequest(userId: string, client: ClientContext): Promise<void> {
    const now = new Date();
    const pending = await this.families.findPendingRequestOfUser(userId);
    if (!pending || pending.expiresAt <= now) {
      throw new JoinRequestNotFoundError();
    }
    if (
      !(await this.families.closeJoinRequest(
        pending.id,
        JoinRequestStatus.CANCELLED,
        userId,
        now,
      ))
    ) {
      throw new JoinRequestClosedError();
    }
    await this.audit.record({
      action: AuditAction.FAMILY_JOIN_CANCELLED,
      actor: { type: 'USER', userId },
      target: { type: 'FAMILY', id: pending.familyId },
      client,
      metadata: { requestId: pending.id },
    });
  }

  async listJoinRequests(userId: string): Promise<IncomingJoinRequestView[]> {
    const owner = await this.requireOwner(userId);
    const now = new Date();
    const pending = (
      await this.families.listPendingRequests(owner.familyId)
    ).filter((request) => request.expiresAt > now);
    const cards = await this.profiles.getMemberCards(
      pending.map((request) => request.userId),
      new Set(),
    );
    return pending.map((request) => ({
      id: request.id,
      userId: request.userId,
      firstName: request.firstName,
      lastName: request.lastName,
      avatar: cards.get(request.userId)?.avatar ?? null,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
    }));
  }

  async approveJoinRequest(
    userId: string,
    requestId: string,
    client: ClientContext,
  ): Promise<MyFamilyView> {
    const owner = await this.requireOwner(userId);
    const now = new Date();
    await this.unitOfWork.run(async () => {
      await this.families.lockFamily(owner.familyId);
      const request = await this.requireOpenRequest(
        owner.familyId,
        requestId,
        now,
      );

      // The requester may have changed since asking: still an active driver,
      // still without a family?
      const requester = await this.users.findById(request.userId);
      if (
        !requester ||
        requester.role !== Role.DRIVER ||
        requester.accountState !== AccountState.ACTIVE
      ) {
        await this.families.closeJoinRequest(
          request.id,
          JoinRequestStatus.CANCELLED,
          userId,
          now,
        );
        throw new JoinRequestClosedError();
      }
      if (await this.families.findMembership(request.userId)) {
        await this.families.closeJoinRequest(
          request.id,
          JoinRequestStatus.CANCELLED,
          userId,
          now,
        );
        throw new AlreadyInFamilyError('driver');
      }
      // Request kept open: the owner can make room, then approve again.
      if (
        (await this.families.countMembers(owner.familyId)) >=
        FamilyPolicy.MAX_MEMBERS
      ) {
        throw new FamilyFullError();
      }

      await this.families.addMember(
        owner.familyId,
        request.userId,
        FamilyRole.MEMBER,
      );
      await this.families.closeJoinRequest(
        request.id,
        JoinRequestStatus.APPROVED,
        userId,
        now,
      );
      await this.audit.record({
        action: AuditAction.FAMILY_JOIN_APPROVED,
        actor: { type: 'USER', userId },
        target: { type: 'FAMILY', id: owner.familyId },
        client,
        metadata: { requestId: request.id, memberId: request.userId },
      });
      await this.notifications.notify(request.userId, {
        type: 'FAMILY_JOIN_APPROVED',
        familyName: request.familyName,
      });
      await this.announceNewMember(
        owner.familyId,
        request.userId,
        `${request.firstName} ${request.lastName}`,
        request.familyName,
        userId,
      );
    });
    return this.getMine(userId);
  }

  async rejectJoinRequest(
    userId: string,
    requestId: string,
    client: ClientContext,
  ): Promise<void> {
    const owner = await this.requireOwner(userId);
    const now = new Date();
    const request = await this.requireOpenRequest(
      owner.familyId,
      requestId,
      now,
    );
    if (
      !(await this.families.closeJoinRequest(
        request.id,
        JoinRequestStatus.REJECTED,
        userId,
        now,
      ))
    ) {
      throw new JoinRequestClosedError();
    }
    await this.audit.record({
      action: AuditAction.FAMILY_JOIN_REJECTED,
      actor: { type: 'USER', userId },
      target: { type: 'FAMILY', id: owner.familyId },
      client,
      metadata: { requestId: request.id },
    });
    await this.notifications.notify(request.userId, {
      type: 'FAMILY_JOIN_REJECTED',
      familyName: request.familyName,
    });
  }

  // --------------------------------------------- driver: membership changes

  async removeMember(
    userId: string,
    memberUserId: string,
    client: ClientContext,
  ): Promise<MyFamilyView> {
    const owner = await this.requireOwner(userId);
    if (memberUserId === userId) throw new CannotRemoveYourselfError();
    await this.unitOfWork.run(async () => {
      await this.families.lockFamily(owner.familyId);
      const member = await this.families.findMembership(memberUserId);
      if (!member || member.familyId !== owner.familyId) {
        throw new FamilyMemberNotFoundError();
      }
      await this.detach(member, { userId, client }, 'REMOVED');
    });
    return this.getMine(userId);
  }

  async transferOwnership(
    userId: string,
    newOwnerId: string,
    client: ClientContext,
  ): Promise<MyFamilyView> {
    const owner = await this.requireOwner(userId);
    await this.unitOfWork.run(async () => {
      await this.families.lockFamily(owner.familyId);
      await this.changeOwner(owner.familyId, newOwnerId, { userId, client });
    });
    return this.getMine(userId);
  }

  /**
   * Anyone can leave. When the owner leaves, the longest-standing member
   * becomes owner; when they were alone, the family is dissolved.
   */
  async leave(userId: string, client: ClientContext): Promise<MyFamilyView> {
    const membership = await this.requireMembership(userId);
    await this.unitOfWork.run(async () => {
      await this.families.lockFamily(membership.familyId);
      const current = await this.requireMembership(userId);
      await this.detach(current, { userId, client }, 'LEFT');
    });
    return this.getMine(userId);
  }

  /** The member's own consent; each flag can be withdrawn at any time. */
  async updateSharing(
    userId: string,
    sharing: Partial<FamilySharing>,
    client: ClientContext,
  ): Promise<MyFamilyView> {
    const membership = await this.requireMembership(userId);
    await this.families.updateSharing(userId, sharing, new Date());
    await this.audit.record({
      action: AuditAction.FAMILY_SHARING_UPDATED,
      actor: { type: 'USER', userId },
      target: { type: 'FAMILY', id: membership.familyId },
      client,
      metadata: { ...sharing },
    });
    return this.getMine(userId);
  }

  /**
   * Account lifecycle hook (suspension, deletion): the driver leaves their
   * family and their pending request is withdrawn, so no family keeps an
   * owner who can no longer act. Runs inside the caller's transaction.
   */
  async detachUser(userId: string, actor: Actor): Promise<void> {
    const now = new Date();
    await this.unitOfWork.run(async () => {
      await this.families.cancelPendingRequestsOfUser(userId, now);
      const membership = await this.families.findMembership(userId);
      if (!membership) return;
      await this.families.lockFamily(membership.familyId);
      await this.detach(membership, actor, 'REMOVED');
    });
  }

  // ------------------------------------------------------------ admin

  async adminList(
    filter: FamilyListFilter,
  ): Promise<{ items: AdminFamilyView[]; totalItems: number }> {
    const page = await this.families.listFamilies(filter);
    return {
      totalItems: page.totalItems,
      items: page.items.map(toAdminSummary),
    };
  }

  async adminStats(): Promise<AdminFamilyStatsView> {
    const stats = await this.families.getAdminStats(new Date());
    return {
      ...stats,
      maxMembersPerFamily: FamilyPolicy.MAX_MEMBERS,
      availableSeats: Math.max(
        0,
        stats.totalFamilies * FamilyPolicy.MAX_MEMBERS - stats.totalMembers,
      ),
      averageMembers:
        stats.totalFamilies === 0
          ? 0
          : Number((stats.totalMembers / stats.totalFamilies).toFixed(1)),
    };
  }

  async adminGet(familyId: string): Promise<AdminFamilyView> {
    const family = await this.requireFamily(familyId);
    const now = new Date();
    const [members, pending] = await Promise.all([
      this.families.listMembers(familyId),
      this.families.listPendingRequests(familyId),
    ]);
    const owner = members.find((m) => m.role === FamilyRole.OWNER);
    return {
      id: family.id,
      name: family.name,
      createdAt: family.createdAt,
      memberCount: members.length,
      owner: owner
        ? {
            userId: owner.userId,
            firstName: owner.firstName,
            lastName: owner.lastName,
          }
        : null,
      members: members.map((m) => ({
        userId: m.userId,
        firstName: m.firstName,
        lastName: m.lastName,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      pendingRequestCount: pending.filter((r) => r.expiresAt > now).length,
    };
  }

  async adminAddMember(
    familyId: string,
    driverId: string,
    actor: Actor,
  ): Promise<AdminFamilyView> {
    const driver = await this.users.findById(driverId);
    if (!driver) throw new UserNotFoundError();
    if (driver.role !== Role.DRIVER) throw new NotADriverError();
    const now = new Date();
    await this.unitOfWork.run(async () => {
      if (!(await this.families.lockFamily(familyId))) {
        throw new FamilyNotFoundError();
      }
      if (await this.families.findMembership(driverId)) {
        throw new AlreadyInFamilyError('driver');
      }
      if (
        (await this.families.countMembers(familyId)) >= FamilyPolicy.MAX_MEMBERS
      ) {
        throw new FamilyFullError();
      }
      await this.families.cancelPendingRequestsOfUser(driverId, now);
      await this.families.addMember(familyId, driverId, FamilyRole.MEMBER);
      await this.audit.record({
        action: AuditAction.FAMILY_MEMBER_ADDED,
        actor: { type: 'USER', userId: actor.userId },
        target: { type: 'FAMILY', id: familyId },
        client: actor.client,
        metadata: { memberId: driverId },
      });
      const family = await this.requireFamily(familyId);
      await this.notifications.notify(driverId, {
        type: 'FAMILY_ADDED',
        familyName: family.name,
      });
      await this.announceNewMember(
        familyId,
        driverId,
        `${driver.firstName} ${driver.lastName}`,
        family.name,
        null,
      );
    });
    return this.adminGet(familyId);
  }

  async adminRemoveMember(
    familyId: string,
    memberUserId: string,
    actor: Actor,
  ): Promise<AdminFamilyView | null> {
    let dissolved = false;
    await this.unitOfWork.run(async () => {
      if (!(await this.families.lockFamily(familyId))) {
        throw new FamilyNotFoundError();
      }
      const member = await this.families.findMembership(memberUserId);
      if (!member || member.familyId !== familyId) {
        throw new FamilyMemberNotFoundError();
      }
      dissolved = await this.detach(member, actor, 'REMOVED');
    });
    return dissolved ? null : this.adminGet(familyId);
  }

  async adminSetOwner(
    familyId: string,
    newOwnerId: string,
    actor: Actor,
  ): Promise<AdminFamilyView> {
    await this.unitOfWork.run(async () => {
      if (!(await this.families.lockFamily(familyId))) {
        throw new FamilyNotFoundError();
      }
      await this.changeOwner(familyId, newOwnerId, actor);
    });
    return this.adminGet(familyId);
  }

  async adminDissolve(familyId: string, actor: Actor): Promise<void> {
    await this.requireFamily(familyId);
    await this.dissolveFamily(familyId, actor);
  }

  // ------------------------------------------------------------ internals

  /** @returns true when the family was dissolved (its last member left). */
  private async detach(
    member: FamilyMemberRecord,
    actor: Actor,
    reason: DetachReason,
  ): Promise<boolean> {
    const members = await this.families.listMembers(member.familyId);
    const others = members.filter((m) => m.userId !== member.userId);
    const familyName = (await this.requireFamily(member.familyId)).name;

    if (member.role === FamilyRole.OWNER && others.length === 0) {
      await this.families.deleteFamily(member.familyId);
      await this.audit.record({
        action: AuditAction.FAMILY_DISSOLVED,
        actor: { type: 'USER', userId: actor.userId },
        target: { type: 'FAMILY', id: member.familyId },
        client: actor.client,
        metadata: { reason: 'LAST_MEMBER_LEFT' },
      });
      return true;
    }

    await this.families.removeMember(member.userId);
    await this.audit.record({
      action:
        reason === 'LEFT'
          ? AuditAction.FAMILY_MEMBER_LEFT
          : AuditAction.FAMILY_MEMBER_REMOVED,
      actor: { type: 'USER', userId: actor.userId },
      target: { type: 'FAMILY', id: member.familyId },
      client: actor.client,
      metadata: { memberId: member.userId },
    });
    if (reason === 'LEFT') {
      await this.notifications.notify(
        others.map((m) => m.userId),
        {
          type: 'FAMILY_MEMBER_LEFT',
          memberName: `${member.firstName} ${member.lastName}`,
          familyName,
        },
      );
    } else if (member.userId !== actor.userId) {
      await this.notifications.notify(member.userId, {
        type: 'FAMILY_MEMBER_REMOVED',
        familyName,
      });
    }

    if (member.role === FamilyRole.OWNER) {
      // Longest-standing member (others is ordered by join date).
      const successor = others[0];
      await this.families.setRole(successor.userId, FamilyRole.OWNER);
      await this.notifications.notify(successor.userId, {
        type: 'FAMILY_OWNERSHIP_RECEIVED',
        familyName,
      });
      await this.audit.record({
        action: AuditAction.FAMILY_OWNERSHIP_TRANSFERRED,
        actor: { type: 'USER', userId: actor.userId },
        target: { type: 'FAMILY', id: member.familyId },
        client: actor.client,
        metadata: {
          from: member.userId,
          to: successor.userId,
          automatic: true,
        },
      });
    }
    return false;
  }

  /** Must run in a transaction holding the family lock. */
  private async changeOwner(
    familyId: string,
    newOwnerId: string,
    actor: Actor,
  ): Promise<void> {
    const members = await this.families.listMembers(familyId);
    const target = members.find((m) => m.userId === newOwnerId);
    if (!target) throw new FamilyMemberNotFoundError();
    const current = members.find((m) => m.role === FamilyRole.OWNER);
    if (current?.userId === newOwnerId) return;
    // Demote first: the database allows only one owner at any instant.
    if (current) await this.families.setRole(current.userId, FamilyRole.MEMBER);
    await this.families.setRole(newOwnerId, FamilyRole.OWNER);
    if (newOwnerId !== actor.userId) {
      await this.notifications.notify(newOwnerId, {
        type: 'FAMILY_OWNERSHIP_RECEIVED',
        familyName: (await this.requireFamily(familyId)).name,
      });
    }
    await this.audit.record({
      action: AuditAction.FAMILY_OWNERSHIP_TRANSFERRED,
      actor: { type: 'USER', userId: actor.userId },
      target: { type: 'FAMILY', id: familyId },
      client: actor.client,
      metadata: { from: current?.userId ?? null, to: newOwnerId },
    });
  }

  private async dissolveFamily(familyId: string, actor: Actor): Promise<void> {
    await this.unitOfWork.run(async () => {
      await this.families.lockFamily(familyId);
      const family = await this.requireFamily(familyId);
      const members = await this.families.listMembers(familyId);
      const memberCount = members.length;
      await this.families.deleteFamily(familyId);
      await this.notifications.notify(
        members.map((m) => m.userId).filter((id) => id !== actor.userId),
        { type: 'FAMILY_DISSOLVED', familyName: family.name },
      );
      await this.audit.record({
        action: AuditAction.FAMILY_DISSOLVED,
        actor: { type: 'USER', userId: actor.userId },
        target: { type: 'FAMILY', id: familyId },
        client: actor.client,
        metadata: { memberCount },
      });
    });
  }

  private async describeFor(
    membership: FamilyMemberRecord,
    now: Date,
  ): Promise<FamilyView> {
    const family = await this.requireFamily(membership.familyId);
    const members = await this.families.listMembers(membership.familyId);
    const sharingPhone = new Set(
      members.filter((m) => m.sharing.phone).map((m) => m.userId),
    );
    const cards = await this.profiles.getMemberCards(
      members.map((m) => m.userId),
      sharingPhone,
    );
    const isOwner = membership.role === FamilyRole.OWNER;
    const pendingRequestCount = isOwner
      ? (await this.families.listPendingRequests(family.id)).filter(
          (request) => request.expiresAt > now,
        ).length
      : null;
    return {
      id: family.id,
      name: family.name,
      myRole: membership.role,
      mySharing: membership.sharing,
      maxMembers: FamilyPolicy.MAX_MEMBERS,
      pendingRequestCount,
      members: members.map((m) => ({
        userId: m.userId,
        firstName: m.firstName,
        lastName: m.lastName,
        role: m.role,
        joinedAt: m.joinedAt,
        avatar: cards.get(m.userId)?.avatar ?? null,
        phoneNumber: cards.get(m.userId)?.phoneNumber ?? null,
        sharing: m.sharing,
      })),
    };
  }

  private async issueInviteCode(
    familyId: string,
    now: Date,
  ): Promise<FamilyInviteView> {
    const expiresAt = new Date(now.getTime() + FamilyPolicy.INVITE_CODE_TTL_MS);
    // ~40 bits: a collision is astronomically rare, but never silently fatal.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      if (await this.families.setInviteCode(familyId, code, expiresAt)) {
        return this.inviteView(code, expiresAt);
      }
    }
    throw new Error('Could not allocate a unique family invite code');
  }

  private inviteView(code: string, expiresAt: Date): FamilyInviteView {
    const display = formatInviteCode(code);
    return {
      code: display,
      link: `${this.app.familyInviteUrl}#${display}`,
      expiresAt,
    };
  }

  private async familyForCode(
    rawCode: string,
    now: Date,
  ): Promise<FamilyRecord> {
    const code = normalizeInviteCode(rawCode);
    if (!isWellFormedInviteCode(code)) throw new FamilyInviteInvalidError();
    const family = await this.families.findByInviteCode(code);
    if (!family?.inviteCodeExpiresAt || family.inviteCodeExpiresAt <= now) {
      throw new FamilyInviteInvalidError();
    }
    return family;
  }

  private async requireOpenRequest(
    familyId: string,
    requestId: string,
    now: Date,
  ): Promise<JoinRequestRecord> {
    const request = await this.families.findJoinRequest(requestId);
    if (!request || request.familyId !== familyId) {
      throw new JoinRequestNotFoundError();
    }
    if (request.status !== JoinRequestStatus.PENDING) {
      throw new JoinRequestClosedError();
    }
    if (request.expiresAt <= now) {
      await this.families.closeJoinRequest(
        request.id,
        JoinRequestStatus.EXPIRED,
        null,
        now,
      );
      throw new JoinRequestClosedError();
    }
    return request;
  }

  private async requireMembership(userId: string): Promise<FamilyMemberRecord> {
    const membership = await this.families.findMembership(userId);
    if (!membership) throw new NotInFamilyError();
    return membership;
  }

  private async requireOwner(userId: string): Promise<FamilyMemberRecord> {
    const membership = await this.requireMembership(userId);
    if (membership.role !== FamilyRole.OWNER) throw new FamilyOwnerOnlyError();
    return membership;
  }

  /** Tells existing members (not the newcomer, not whoever approved) about a join. */
  private async announceNewMember(
    familyId: string,
    newMemberId: string,
    memberName: string,
    familyName: string,
    approvedBy: string | null,
  ): Promise<void> {
    const members = await this.families.listMembers(familyId);
    await this.notifications.notify(
      members
        .map((m) => m.userId)
        .filter((id) => id !== newMemberId && id !== approvedBy),
      { type: 'FAMILY_MEMBER_JOINED', memberName, familyName },
    );
  }

  private async requireFamily(familyId: string): Promise<FamilyRecord> {
    const family = await this.families.findFamily(familyId);
    if (!family) throw new FamilyNotFoundError();
    return family;
  }
}

function toRequestView(request: JoinRequestRecord): JoinRequestView {
  return {
    id: request.id,
    familyName: request.familyName,
    status: request.status,
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
  };
}

function toAdminSummary(family: FamilySummaryRecord): AdminFamilyView {
  return {
    id: family.id,
    name: family.name,
    createdAt: family.createdAt,
    memberCount: family.memberCount,
    owner: family.owner,
  };
}
