import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { authConfig, type AuthConfig } from '../../config';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { SecurityModule } from '../security/security.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { AccessTokenValidator } from './application/access-token-validator';
import { AuthService } from './application/auth.service';
import { PasswordResetTokenRepository } from './domain/password-reset-token.repository';
import { AccessTokenIssuer } from './infrastructure/access-token.issuer';
import { JwtAccessStrategy } from './infrastructure/jwt-access.strategy';
import { PrismaPasswordResetTokenRepository } from './infrastructure/prisma-password-reset-token.repository';
import { AuthCookieService } from './presentation/auth-cookie.service';
import { AuthController } from './presentation/auth.controller';

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
  ],
  controllers: [AuthController],
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
  ],
})
export class AuthModule {}
