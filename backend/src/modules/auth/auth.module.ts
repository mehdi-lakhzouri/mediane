import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { authConfig, type AuthConfig } from '../../config';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { MfaModule } from '../mfa/mfa.module';
import { SecurityModule } from '../security/security.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { AccessTokenValidator } from './application/access-token-validator';
import { AuthService } from './application/auth.service';
import { MfaChallengeRepository } from './domain/mfa-challenge.repository';
import { PasswordResetTokenRepository } from './domain/password-reset-token.repository';
import { AccessTokenIssuer } from './infrastructure/access-token.issuer';
import { JwtAccessStrategy } from './infrastructure/jwt-access.strategy';
import { PrismaMfaChallengeRepository } from './infrastructure/prisma-mfa-challenge.repository';
import { PrismaPasswordResetTokenRepository } from './infrastructure/prisma-password-reset-token.repository';
import { AuthCookieService } from './presentation/auth-cookie.service';
import { AuthController } from './presentation/auth.controller';
import { MobileAuthController } from './presentation/mobile-auth.controller';

/**
 * Global guards (JwtAuthGuard, RolesGuard, AccountStateGuard) are registered in
 * AppModule to control their order; they live in ./presentation/guards.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (auth: AuthConfig) => ({
        secret: auth.jwt.accessSecret,
        signOptions: {
          algorithm: auth.jwt.algorithm,
          expiresIn: auth.jwt.accessTtlSeconds,
          issuer: auth.jwt.issuer,
          audience: auth.jwt.audience,
        },
        verifyOptions: {
          algorithms: [auth.jwt.algorithm],
          issuer: auth.jwt.issuer,
          audience: auth.jwt.audience,
        },
      }),
    }),
    SecurityModule,
    UsersModule,
    SessionsModule,
    AuditModule,
    MailModule,
    MfaModule,
  ],
  controllers: [AuthController, MobileAuthController],
  providers: [
    AuthService,
    AccessTokenValidator,
    AccessTokenIssuer,
    JwtAccessStrategy,
    AuthCookieService,
    {
      provide: PasswordResetTokenRepository,
      useClass: PrismaPasswordResetTokenRepository,
    },
    { provide: MfaChallengeRepository, useClass: PrismaMfaChallengeRepository },
  ],
})
export class AuthModule {}
