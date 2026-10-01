import { Module } from '@nestjs/common';
import { AuditService } from './application/audit.service';
import { AuditLogRepository } from './domain/audit-log.repository';
import { PrismaAuditLogRepository } from './infrastructure/prisma-audit-log.repository';

@Module({
  providers: [
    AuditService,
    { provide: AuditLogRepository, useClass: PrismaAuditLogRepository },
  ],
  exports: [AuditService],
})
export class AuditModule {}
