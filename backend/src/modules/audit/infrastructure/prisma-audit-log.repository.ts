import { Injectable } from '@nestjs/common';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import type { AuditRecord } from '../domain/audit-entry';
import { AuditLogRepository } from '../domain/audit-log.repository';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: PrismaTransactionHost) {}

  async append(record: AuditRecord): Promise<void> {
    const { metadata, ...columns } = record;
    await this.db.client.auditLog.create({
      data: { ...columns, ...(metadata ? { metadata } : {}) },
    });
  }
}
