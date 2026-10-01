import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SecurityModule } from '../security/security.module';
import { SessionsService } from './application/sessions.service';
import { RefreshSessionRepository } from './domain/refresh-session.repository';
import { PrismaRefreshSessionRepository } from './infrastructure/prisma-refresh-session.repository';

@Module({
  imports: [SecurityModule, AuditModule],
  providers: [
    SessionsService,
    {
      provide: RefreshSessionRepository,
      useClass: PrismaRefreshSessionRepository,
    },
  ],
  exports: [SessionsService],
})
export class SessionsModule {}
