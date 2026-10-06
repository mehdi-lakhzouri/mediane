import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import type { JsonObject } from '../../../common/domain/json';
import {
  AUDIT_ACTIONS_BY_CATEGORY,
  AuditCategory,
} from '../domain/audit-category';
import type { AuditAction } from '../domain/audit-action';
import type {
  AuditActorType,
  AuditOutcome,
  AuditRecord,
  AuditTargetType,
} from '../domain/audit-entry';
import {
  AuditListFilter,
  AuditLogRepository,
  AuditLogViewRecord,
  AuditStatsRecord,
} from '../domain/audit-log.repository';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toView(row: {
  id: string;
  action: string;
  outcome: AuditOutcome;
  actorType: AuditActorType;
  actorUserId: string | null;
  targetType: string | null;
  targetId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}): AuditLogViewRecord {
  return {
    ...row,
    action: row.action as AuditAction,
    targetType: row.targetType as AuditTargetType | null,
    metadata: row.metadata as JsonObject | null,
  };
}

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: PrismaTransactionHost) {}

  async append(record: AuditRecord): Promise<void> {
    const { metadata, ...columns } = record;
    await this.db.client.auditLog.create({
      data: { ...columns, ...(metadata ? { metadata } : {}) },
    });
  }

  async list(
    filter: AuditListFilter,
  ): Promise<{ items: AuditLogViewRecord[]; totalItems: number }> {
    const search = filter.search?.trim();
    const where: Prisma.AuditLogWhereInput = {
      ...(filter.category
        ? { action: { in: [...AUDIT_ACTIONS_BY_CATEGORY[filter.category]] } }
        : {}),
      ...(filter.actorType ? { actorType: filter.actorType } : {}),
      ...(filter.outcome ? { outcome: filter.outcome } : {}),
      ...(filter.targetType ? { targetType: filter.targetType } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { requestId: { contains: search, mode: 'insensitive' } },
              { ipAddress: { contains: search, mode: 'insensitive' } },
              ...(UUID.test(search)
                ? [{ actorUserId: search }, { targetId: search }]
                : []),
            ],
          }
        : {}),
    };

    const [rows, totalItems] = await Promise.all([
      this.db.client.auditLog.findMany({
        where,
        orderBy: [{ createdAt: filter.sortDir ?? 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.db.client.auditLog.count({ where }),
    ]);
    return { items: rows.map(toView), totalItems };
  }

  async stats(now: Date): Promise<AuditStatsRecord> {
    const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [total, last24Hours, securityEvents, failures, actors] =
      await Promise.all([
        this.db.client.auditLog.count(),
        this.db.client.auditLog.count({
          where: { createdAt: { gte: lastDay } },
        }),
        this.db.client.auditLog.count({
          where: {
            action: {
              in: [...AUDIT_ACTIONS_BY_CATEGORY[AuditCategory.SECURITY]],
            },
          },
        }),
        this.db.client.auditLog.count({
          where: { outcome: 'FAILURE' },
        }),
        this.db.client.auditLog.groupBy({
          by: ['actorUserId'],
          where: { actorUserId: { not: null } },
        }),
      ]);
    return {
      total,
      last24Hours,
      securityEvents,
      failures,
      uniqueActors: actors.length,
    };
  }
}
