import { Inject, Injectable } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { authConfig, type AuthConfig } from '../../../config';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action';
import { SecureTokenService } from '../../security/infrastructure/secure-token.service';
import type { EffectiveInvitationStatus } from '../domain/invitation';
import { InvitationStatus } from '../domain/invitation';
import {
  InvalidInvitationError,
  InvitationNotFoundError,
} from '../domain/invitation.errors';
import {
  AdminInvitationListFilter,
  AdminInvitationRecord,
  AdminInvitationStatsRecord,
  InvitationRepository,
} from '../domain/invitation.repository';
import { UserRepository } from '../../users/domain/user.repository';

export interface InvitationStatusView {
  invitationId: string;
  status: EffectiveInvitationStatus;
  invitedBy: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export type AdminInvitationView = AdminInvitationRecord;

export interface AdminInvitationStatsView extends AdminInvitationStatsRecord {
  acceptanceRate: number;
}

/** What the caller needs to build the acceptance link. */
export interface IssuedInvitation {
  invitationId: string;
  /** Raw token: goes into the email link only, never stored or logged. */
  rawToken: string;
  expiresAt: Date;
}

/**
 * Owns the invitation token lifecycle. The temporary password that travels in
 * the same email belongs to the user's account, so the admin context owns that
 * half and calls `issueFor` for the token.
 *
 * Invariants:
 *  - the raw token is 256 bits of randomness and only its HMAC is stored;
 *  - at most one PENDING invitation per user: issuing supersedes the others in
 *    the same transaction, which is what makes a resend invalidate the old link.
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly tokens: SecureTokenService,
    private readonly audit: AuditService,
    private readonly unitOfWork: UnitOfWork,
    @Inject(authConfig.KEY) private readonly auth: AuthConfig,
  ) {}

  async adminList(
    filter: AdminInvitationListFilter,
  ): Promise<{ items: AdminInvitationView[]; totalItems: number }> {
    return this.invitations.adminList(filter, new Date());
  }

  async adminStats(): Promise<AdminInvitationStatsView> {
    const stats = await this.invitations.adminStats(new Date());
    return {
      ...stats,
      acceptanceRate:
        stats.total === 0
          ? 0
          : Number(((stats.accepted / stats.total) * 100).toFixed(1)),
    };
  }

  async issueFor(
    userId: string,
    invitedById: string,
    now = new Date(),
  ): Promise<IssuedInvitation> {
    const rawToken = this.tokens.generateToken();
    const expiresAt = new Date(
      now.getTime() + this.auth.invitationTtlSeconds * 1000,
    );

    return this.unitOfWork.run(async () => {
      await this.invitations.supersedePendingForUser(userId, now);
      const invitation = await this.invitations.create({
        userId,
        invitedById,
        tokenHash: this.tokens.hashToken(rawToken),
        expiresAt,
      });
      return { invitationId: invitation.id, rawToken, expiresAt };
    });
  }

  async getStatusForUser(userId: string): Promise<InvitationStatusView> {
    const invitation = await this.invitations.findLatestForUser(userId);
    if (!invitation) throw new InvitationNotFoundError();
    const inviter = invitation.invitedById
      ? await this.users.findByIdIncludingDeleted(invitation.invitedById)
      : null;
    return {
      invitationId: invitation.id,
      status: invitation.effectiveStatus(new Date()),
      invitedBy: inviter
        ? `${inviter.firstName} ${inviter.lastName}`.trim()
        : null,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  /** Revoking leaves no usable link; a later resend issues a fresh one. */
  async revoke(
    userId: string,
    actorId: string,
    client: ClientContext,
  ): Promise<InvitationStatusView> {
    const now = new Date();
    const invitation = await this.invitations.findLatestForUser(userId);
    if (!invitation) throw new InvitationNotFoundError();

    return this.unitOfWork.run(async () => {
      const revoked = await this.invitations.revoke(
        invitation.id,
        actorId,
        now,
      );
      const inviter = invitation.invitedById
        ? await this.users.findByIdIncludingDeleted(invitation.invitedById)
        : null;
      await this.audit.record({
        action: AuditAction.INVITATION_REVOKED,
        actor: { type: 'USER', userId: actorId },
        target: { type: 'INVITATION', id: invitation.id },
        client,
        metadata: { userId, wasPending: revoked },
      });
      return {
        invitationId: invitation.id,
        status: revoked
          ? InvitationStatus.REVOKED
          : invitation.effectiveStatus(now),
        invitedBy: inviter
          ? `${inviter.firstName} ${inviter.lastName}`.trim()
          : null,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      };
    });
  }

  /**
   * Public acceptance flow (driver side). Unknown, expired, revoked, superseded
   * and already-used tokens all raise the same error: this endpoint is reachable
   * without a session and must not report on a token's state.
   *
   * It does NOT sign the driver in. They still have to authenticate with the
   * temporary password, which keeps the link alone from granting access.
   */
  async accept(rawToken: string, client: ClientContext): Promise<void> {
    const now = new Date();
    const tokenHash = this.tokens.hashToken(rawToken);

    await this.unitOfWork.run(async () => {
      const accepted = await this.invitations.accept(tokenHash, now);
      if (!accepted) throw new InvalidInvitationError();

      // A deleted or suspended account must not be revived by its old link.
      if (!(await this.users.activateInvitedUser(accepted.userId, now))) {
        throw new InvalidInvitationError();
      }

      await this.audit.record({
        action: AuditAction.INVITATION_ACCEPTED,
        actor: { type: 'USER', userId: accepted.userId },
        target: { type: 'INVITATION', id: accepted.invitationId },
        client,
        metadata: { userId: accepted.userId },
      });
    });
  }
}
