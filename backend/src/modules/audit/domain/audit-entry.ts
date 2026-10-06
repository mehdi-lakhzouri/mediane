import type { ClientContext } from '../../../common/application/client-context';
import type { JsonObject } from '../../../common/domain/json';
import type { AuditAction } from './audit-action';

export type AuditActorType = 'USER' | 'SYSTEM' | 'CLI' | 'DEVICE';
export type AuditOutcome = 'SUCCESS' | 'FAILURE';
export type AuditTargetType =
  'USER' | 'INVITATION' | 'SESSION' | 'FAMILY' | 'DEVICE' | 'INCIDENT';

/** What business code submits. `metadata` is sanitized before persistence. */
export interface AuditEntry {
  action: AuditAction;
  outcome?: AuditOutcome;
  actor: { type: AuditActorType; userId?: string | null };
  target?: { type: AuditTargetType; id: string };
  client?: ClientContext;
  metadata?: Record<string, unknown>;
}

/** What is persisted (append-only). */
export interface AuditRecord {
  action: AuditAction;
  outcome: AuditOutcome;
  actorType: AuditActorType;
  actorUserId: string | null;
  targetType: AuditTargetType | null;
  targetId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: JsonObject | null;
}
