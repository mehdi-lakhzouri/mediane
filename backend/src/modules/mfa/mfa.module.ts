import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SecurityModule } from '../security/security.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { MfaService } from './application/mfa.service';
import { MfaVerifier } from './application/mfa-verifier';
import { UserMfaRepository } from './domain/user-mfa.repository';
import { MfaSecretCipher } from './infrastructure/mfa-secret.cipher';
import { PrismaUserMfaRepository } from './infrastructure/prisma-user-mfa.repository';
import { MfaController } from './presentation/mfa.controller';

/**
 * Second factor (TOTP + recovery codes). The login step that USES it lives in
 * auth (AuthService.completeMfaChallenge) through MfaVerifier; this module
 * never depends on auth, so there is no cycle.
 */
@Module({
  imports: [
    UsersModule,
    SessionsModule,
    SecurityModule,
    AuditModule,
    NotificationsModule,
  ],
  controllers: [MfaController],
  providers: [
    MfaService,
    MfaVerifier,
    MfaSecretCipher,
    { provide: UserMfaRepository, useClass: PrismaUserMfaRepository },
  ],
  exports: [MfaService, MfaVerifier],
})
export class MfaModule {}
