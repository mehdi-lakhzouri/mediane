import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/http/errors/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/http/response/response-envelope.interceptor';
import { createValidationPipe } from './common/http/validation/validation.pipe';
import {
  allConfigs,
  throttleConfig,
  validateEnv,
  type ThrottleConfig,
} from './config';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountStateGuard } from './modules/auth/presentation/guards/account-state.guard';
import { JwtAuthGuard } from './modules/auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/presentation/guards/roles.guard';
import { HealthModule } from './modules/health/health.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MailModule } from './modules/mail/mail.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { CsrfGuard } from './modules/security/presentation/csrf.guard';
import { SecurityModule } from './modules/security/security.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: allConfigs,
    }),
    LoggingModule,
    ThrottlerModule.forRootAsync({
      inject: [throttleConfig.KEY],
      useFactory: (throttle: ThrottleConfig) => ({
        throttlers: [
          {
            name: 'default',
            ttl: throttle.defaultTtlMs,
            limit: throttle.defaultLimit,
          },
        ],
        // Multi-instance deployment: add `storage: new ThrottlerStorageRedisService(...)` here.
      }),
    }),
    PrismaModule,
    SecurityModule,
    AuditModule,
    MailModule,
    UsersModule,
    SessionsModule,
    AuthModule,
    InvitationsModule,
    ProfilesModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    // Global guards run in THIS order (cheapest rejections first):
    // rate limit -> CSRF -> authentication -> role -> account state.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AccountStateGuard },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
