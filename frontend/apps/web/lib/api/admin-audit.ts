import { api } from "./client";

export type AuditCategory =
  | "ACCOUNT"
  | "ACCESS"
  | "SECURITY"
  | "FAMILY"
  | "DEVICE"
  | "SAFETY"
  | "SYSTEM";
export type AuditActorType = "USER" | "SYSTEM" | "CLI" | "DEVICE";
export type AuditOutcome = "SUCCESS" | "FAILURE";
export type AuditTargetType =
  | "USER"
  | "INVITATION"
  | "SESSION"
  | "FAMILY"
  | "DEVICE"
  | "INCIDENT";

export type AuditJson =
  | string
  | number
  | boolean
  | null
  | AuditJson[]
  | { [key: string]: AuditJson };

export interface AdminAuditEntry {
  id: string;
  action: string;
  category: AuditCategory;
  outcome: AuditOutcome;
  actorType: AuditActorType;
  actorUserId: string | null;
  actor: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  targetType: AuditTargetType | null;
  targetId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: { [key: string]: AuditJson } | null;
  createdAt: string;
}

export interface AdminAuditStats {
  total: number;
  last24Hours: number;
  securityEvents: number;
  failures: number;
  uniqueActors: number;
}

export interface AdminAuditPage {
  items: AdminAuditEntry[];
  totalItems: number;
}

export interface ListAdminAuditParams {
  page: number;
  pageSize: number;
  search?: string;
  category?: AuditCategory;
  actorType?: AuditActorType;
  outcome?: AuditOutcome;
  targetType?: AuditTargetType;
  from?: string;
  to?: string;
  sortDir?: "asc" | "desc";
}

export async function listAdminAudit(
  params: ListAdminAuditParams,
): Promise<AdminAuditPage> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.search) query.set("search", params.search);
  if (params.category) query.set("category", params.category);
  if (params.actorType) query.set("actorType", params.actorType);
  if (params.outcome) query.set("outcome", params.outcome);
  if (params.targetType) query.set("targetType", params.targetType);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.sortDir) query.set("sortDir", params.sortDir);

  const { data, meta } = await api.getWithMeta<AdminAuditEntry[]>(
    `/admin/audit?${query.toString()}`,
  );
  return {
    items: data ?? [],
    totalItems: meta.pagination?.totalItems ?? 0,
  };
}

export function getAdminAuditStats(): Promise<AdminAuditStats> {
  return api.get<AdminAuditStats>("/admin/audit/stats");
}
