import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { SecurityModule } from '../security/security.module';
import { UsersModule } from '../users/users.module';
import { InvitationsService } from './application/invitations.service';
import { InvitationRepository } from './domain/invitation.repository';
import { PrismaInvitationRepository } from './infrastructure/prisma-invitation.repository';
import { InvitationsController } from './presentation/invitations.controller';

@Module({
  imports: [UsersModule, SecurityModule, AuditModule, MailModule],
  controllers: [InvitationsController],
  providers: [
    InvitationsService,
    { provide: InvitationRepository, useClass: PrismaInvitationRepository },
  ],
  exports: [InvitationsService],
})
export class InvitationsModule {}
