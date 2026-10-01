import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { Email } from '../../../common/domain/email';
import {
  appConfig,
  authConfig,
  type AppConfig,
  type AuthConfig,
} from '../../../config';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action';
import { InvitationsService } from '../../invitations/application/invitations.service';
import { MailSender } from '../../mail/application/mail-sender';
import { PasswordHasher } from '../../security/application/password-hasher';
import { SecureTokenService } from '../../security/infrastructure/secure-token.service';
import { SessionsService } from '../../sessions/application/sessions.service';
import { SessionRevocationReason } from '../../sessions/domain/refresh-session';
import type { AccountState } from '../../users/domain/account-state';
import type { Role } from '../../users/domain/role';
import { User } from '../../users/domain/user';
import { UserStatus } from '../../users/domain/user-status';
import {
  EmailAlreadyInUseError,
  UserNotFoundError,
} from '../../users/domain/user.errors';
import {
  UserRepository,
  type SortDirection,
  type UserSortField,
} from '../../users/domain/user.repository';
import {
  CannotActOnSelfError,
  HardDeleteConfirmationMismatchError,
  UserAlreadyInStateError,
  UserNotSoftDeletedError,
} from '../domain/admin.errors';

/** Who performs the action + request metadata, passed to every admin use case. */
export interface AdminActor {
  adminId: string;
  client: ClientContext;
}

export interface CreateUserCommand {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface UpdateUserCommand {
  firstName?: string;
  lastName?: string;
}

export interface ListUsersQuery {
  page: number;
  pageSize: number;
  role?: Role;
  status?: UserStatus;
  search?: string;
  includeDeleted: boolean;
  sortBy?: UserSortField;
  sortDir?: SortDirection;
}

export interface AdminUserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  accountState: AccountState;
  lastLoginAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
}

function toView(user: User): AdminUserView {
  const snapshot = user.toSnapshot();
  return {
    id: user.id,
    email: user.email.value,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    accountState: user.accountState,
    lastLoginAt: snapshot.lastLoginAt,
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,
  };
}

/**
 * Administration use cases. Composes the users, invitations, sessions, mail and
 * audit contexts; owns no aggregate of its own.
 *
 * Two rules run through all of it:
 *  - an administrator can never suspend, delete or permanently delete their own
 *    account, so nobody can lock the last admin out by accident;
 *  - anything that should end access (suspend, delete) revokes that user's
 *    sessions in the same transaction, so it takes effect on the next request.
 */
@Injectable()
export class AdminUserManagementService {
  private readonly logger = new Logger(AdminUserManagementService.name);

  constructor(
    private readonly users: UserRepository,
    private readonly invitations: InvitationsService,
    private readonly sessions: SessionsService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: SecureTokenService,
    private readonly mail: MailSender,
    private readonly audit: AuditService,
    private readonly unitOfWork: UnitOfWork,
    @Inject(authConfig.KEY) private readonly auth: AuthConfig,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
  ) {}

  async createUser(
    command: CreateUserCommand,
    actor: AdminActor,
  ): Promise<AdminUserView> {
    const email = Email.create(command.email);
    if (await this.users.existsByEmailIncludingDeleted(email)) {
      throw new EmailAlreadyInUseError();
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.auth.invitationTtlSeconds * 1000,
    );
    // Both secrets are generated here and leave only through the email.
    const temporaryPassword = this.tokens.generateTemporaryPassword();
    // Argon2 is deliberately slow: hash before opening the transaction.
    const passwordHash = await this.hasher.hash(temporaryPassword);

    const created = await this.unitOfWork.run(async () => {
      const user = await this.users.create(
        User.newInvitedUser({
          email,
          firstName: command.firstName,
          lastName: command.lastName,
          role: command.role,
          passwordHash,
          temporaryPasswordExpiresAt: expiresAt,
          createdById: actor.adminId,
        }),
      );
      const invitation = await this.invitations.issueFor(
        user.id,
        actor.adminId,
        now,
      );
      await this.audit.record({
        action: AuditAction.USER_CREATED,
        actor: { type: 'USER', userId: actor.adminId },
        target: { type: 'USER', id: user.id },
        client: actor.client,
        metadata: { role: user.role, invitationId: invitation.invitationId },
      });
      await this.audit.record({
        action: AuditAction.INVITATION_SENT,
        actor: { type: 'USER', userId: actor.adminId },
        target: { type: 'INVITATION', id: invitation.invitationId },
        client: actor.client,
        metadata: { userId: user.id, expiresAt },
      });
      return { user, invitationToken: invitation.rawToken };
    });

    // After commit only: a rolled-back invitation must never be emailed.
    await this.sendInvitation(created.user, {
      temporaryPassword,
      invitationToken: created.invitationToken,
      expiresAt,
      resend: false,
      requestId: actor.client.requestId,
    });

    return toView(created.user);
  }

  /**
   * Issues a brand-new invitation AND a brand-new temporary password. Both
   * previous secrets stop working, which is the point: a resend must invalidate
   * whatever was in the earlier email.
   */
  async resendInvitation(
    userId: string,
    actor: AdminActor,
  ): Promise<AdminUserView> {
    const user = await this.requireUser(userId);
    if (user.status === UserStatus.SUSPENDED) {
      throw new UserAlreadyInStateError(
        'Reactivate this account before sending a new invitation.',
      );
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.auth.invitationTtlSeconds * 1000,
    );
    const temporaryPassword = this.tokens.generateTemporaryPassword();
    const passwordHash = await this.hasher.hash(temporaryPassword);

    const issued = await this.unitOfWork.run(async () => {
      const updated = await this.users.setTemporaryPassword(
        user.id,
        passwordHash,
        expiresAt,
      );
      const invitation = await this.invitations.issueFor(
        user.id,
        actor.adminId,
        now,
      );
      await this.audit.record({
        action: AuditAction.INVITATION_RESENT,
        actor: { type: 'USER', userId: actor.adminId },
        target: { type: 'INVITATION', id: invitation.invitationId },
        client: actor.client,
        metadata: { userId: user.id, expiresAt },
      });
      return { user: updated, rawToken: invitation.rawToken };
    });

    await this.sendInvitation(issued.user, {
      temporaryPassword,
      invitationToken: issued.rawToken,
      expiresAt,
      resend: true,
      requestId: actor.client.requestId,
    });

    return toView(issued.user);
  }

  async listUsers(
    query: ListUsersQuery,
  ): Promise<{ items: AdminUserView[]; totalItems: number }> {
    const page = await this.users.list(query);
    return { items: page.items.map(toView), totalItems: page.totalItems };
  }

  async getUser(userId: string): Promise<AdminUserView> {
    return toView(await this.requireUser(userId));
  }

  async updateUser(
    userId: string,
    command: UpdateUserCommand,
    actor: AdminActor,
  ): Promise<AdminUserView> {
    const user = await this.requireUser(userId);
    const patch = {
      ...(command.firstName !== undefined
        ? { firstName: command.firstName.trim() }
        : {}),
      ...(command.lastName !== undefined
        ? { lastName: command.lastName.trim() }
        : {}),
    };
    if (Object.keys(patch).length === 0) return toView(user);

    return this.unitOfWork.run(async () => {
      const updated = await this.users.updateIdentity(user.id, patch);
      await this.audit.record({
        action: AuditAction.USER_UPDATED,
        actor: { type: 'USER', userId: actor.adminId },
        target: { type: 'USER', id: user.id },
        client: actor.client,
        metadata: { fields: Object.keys(patch) },
      });
      return toView(updated);
    });
  }

  async suspendUser(userId: string, actor: AdminActor): Promise<AdminUserView> {
    this.assertNotSelf(userId, actor, 'suspend');
    const user = await this.requireUser(userId);
    if (user.status === UserStatus.SUSPENDED) {
      throw new UserAlreadyInStateError('This account is already suspended.');
    }

    return this.unitOfWork.run(async () => {
      const updated = await this.users.setSuspended(user.id, true, new Date());
      const revoked = await this.sessions.revokeAllForUser(
        user.id,
        SessionRevocationReason.USER_SUSPENDED,
      );
      await this.audit.record({
        action: AuditAction.USER_SUSPENDED,
        actor: { type: 'USER', userId: actor.adminId },
        target: { type: 'USER', id: user.id },
        client: actor.client,
        metadata: { revokedSessions: revoked },
      });
      return toView(updated);
    });
  }

  async reactivateUser(
    userId: string,
    actor: AdminActor,
  ): Promise<AdminUserView> {
    const user = await this.requireUser(userId);
    if (user.status !== UserStatus.SUSPENDED) {
      throw new UserAlreadyInStateError('This account is not suspended.');
    }

    return this.unitOfWork.run(async () => {
      const updated = await this.users.setSuspended(user.id, false, new Date());
      await this.audit.record({
        action: AuditAction.USER_REACTIVATED,
        actor: { type: 'USER', userId: actor.adminId },
        target: { type: 'USER', id: user.id },
        client: actor.client,
      });
      return toView(updated);
    });
  }

  async softDeleteUser(userId: string, actor: AdminActor): Promise<void> {
    this.assertNotSelf(userId, actor, 'delete');
    const user = await this.requireUser(userId);

    await this.unitOfWork.run(async () => {
      await this.users.softDelete(user.id, new Date());
      const revoked = await this.sessions.revokeAllForUser(
        user.id,
        SessionRevocationReason.USER_DELETED,
      );
      await this.audit.record({
        action: AuditAction.USER_SOFT_DELETED,
        actor: { type: 'USER', userId: actor.adminId },
        target: { type: 'USER', id: user.id },
        client: actor.client,
        metadata: { revokedSessions: revoked },
      });
    });
  }

  async restoreUser(userId: string, actor: AdminActor): Promise<AdminUserView> {
    const user = await this.users.findByIdIncludingDeleted(userId);
    if (!user) throw new UserNotFoundError();
    if (!user.isDeleted) {
      throw new UserAlreadyInStateError('This account is not deleted.');
    }

    return this.unitOfWork.run(async () => {
      const restored = await this.users.restore(user.id);
      await this.audit.record({
        action: AuditAction.USER_RESTORED,
        actor: { type: 'USER', userId: actor.adminId },
        target: { type: 'USER', id: user.id },
        client: actor.client,
      });
      return toView(restored);
    });
  }

  async hardDeleteUser(
    userId: string,
    confirmEmail: string,
    actor: AdminActor,
  ): Promise<void> {
    this.assertNotSelf(userId, actor, 'permanently delete');
    const user = await this.users.findByIdIncludingDeleted(userId);
    if (!user) throw new UserNotFoundError();
    if (!user.isDeleted) throw new UserNotSoftDeletedError();
    if (Email.create(confirmEmail).value !== user.email.value) {
      throw new HardDeleteConfirmationMismatchError();
    }

    await this.unitOfWork.run(async () => {
      // Audited before the row disappears; audit rows carry no FK and survive.
      await this.audit.record({
        action: AuditAction.USER_HARD_DELETED,
        actor: { type: 'USER', userId: actor.adminId },
        target: { type: 'USER', id: user.id },
        client: actor.client,
        metadata: { role: user.role },
      });
      await this.users.hardDelete(user.id);
    });
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new UserNotFoundError();
    return user;
  }

  private assertNotSelf(
    userId: string,
    actor: AdminActor,
    action: string,
  ): void {
    if (userId === actor.adminId) throw new CannotActOnSelfError(action);
  }

  /**
   * Delivery failure does not undo the account: the invitation exists and can
   * be resent. It is logged loudly instead, without the secrets.
   */
  private async sendInvitation(
    user: User,
    params: {
      temporaryPassword: string;
      invitationToken: string;
      expiresAt: Date;
      resend: boolean;
      requestId: string;
    },
  ): Promise<void> {
    const mail = {
      to: user.email.value,
      firstName: user.firstName,
      // Fragment: the token never reaches server logs or Referer headers.
      acceptUrl: `${this.app.frontendUrl}/accept-invitation#token=${params.invitationToken}`,
      temporaryPassword: params.temporaryPassword,
      expiresAt: params.expiresAt,
    };
    try {
      await (params.resend
        ? this.mail.sendInvitationResend(mail)
        : this.mail.sendInvitation(mail));
    } catch (err) {
      this.logger.error(
        { err, userId: user.id, requestId: params.requestId },
        'Invitation email could not be sent; the invitation can be resent',
      );
    }
  }
}
