import type { AuditCategory } from './audit-category';
import type {
  AuditActorType,
  AuditOutcome,
  AuditRecord,
  AuditTargetType,
} from './audit-entry';

export interface AuditListFilter {
  page: number;
  pageSize: number;
  search?: string;
  category?: AuditCategory;
  actorType?: AuditActorType;
  outcome?: AuditOutcome;
  targetType?: AuditTargetType;
  from?: Date;
  to?: Date;
  sortDir?: 'asc' | 'desc';
}

export interface AuditLogViewRecord extends AuditRecord {
  id: string;
  createdAt: Date;
}

export interface AuditStatsRecord {
  total: number;
  last24Hours: number;
  securityEvents: number;
  failures: number;
  uniqueActors: number;
}

/** Port. Append-only by design: no update or delete methods. */
export abstract class AuditLogRepository {
  abstract append(record: AuditRecord): Promise<void>;

  abstract list(
    filter: AuditListFilter,
  ): Promise<{ items: AuditLogViewRecord[]; totalItems: number }>;

  abstract stats(now: Date): Promise<AuditStatsRecord>;
}
