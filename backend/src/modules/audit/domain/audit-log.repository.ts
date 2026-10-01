import type { AuditRecord } from './audit-entry';

/** Port. Append-only by design: no update or delete methods. */
export abstract class AuditLogRepository {
  abstract append(record: AuditRecord): Promise<void>;
}
