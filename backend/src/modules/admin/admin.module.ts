import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { MailModule } from '../mail/mail.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { SecurityModule } from '../security/security.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { AdminUserManagementService } from './application/admin-user-management.service';
import { AdminInvitationsController } from './presentation/admin-invitations.controller';
import { AdminUsersController } from './presentation/admin-users.controller';

/**
 * Administration context: owns no aggregate, composes the others.
 * Dependency direction is one-way (admin -> users/invitations/sessions/profiles), no cycles.
 */
@Module({
  imports: [
    UsersModule,
    InvitationsModule,
    SessionsModule,
    SecurityModule,
    AuditModule,
    MailModule,
    ProfilesModule,
  ],
  controllers: [AdminUsersController, AdminInvitationsController],
  providers: [AdminUserManagementService],
})
export class AdminModule {}
