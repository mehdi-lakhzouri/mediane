import { Injectable } from '@nestjs/common';
import type { AuditEntry } from '../domain/audit-entry';
import { AuditLogRepository } from '../domain/audit-log.repository';
import { sanitizeAuditMetadata } from '../domain/sanitize-metadata';

/**
 * Entry point used by business services. Called inside a UnitOfWork, the audit
 * row is written in the same transaction as the business change (both or neither).
 * A failure to audit fails the operation: security-relevant actions must be traceable.
 */
@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditLogRepository) {}

  record(entry: AuditEntry): Promise<void> {
    return this.repository.append({
      action: entry.action,
      outcome: entry.outcome ?? 'SUCCESS',
      actorType: entry.actor.type,
      actorUserId: entry.actor.userId ?? null,
      targetType: entry.target?.type ?? null,
      targetId: entry.target?.id ?? null,
      requestId: entry.client?.requestId ?? null,
      ipAddress: entry.client?.ipAddress ?? null,
      userAgent: entry.client?.userAgent ?? null,
      metadata: sanitizeAuditMetadata(entry.metadata),
    });
  }
}
