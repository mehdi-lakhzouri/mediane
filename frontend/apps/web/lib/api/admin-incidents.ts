import { api } from "./client";

export const INCIDENT_STATUSES = [
  "AWAITING_RESPONSE",
  "ESCALATED",
  "RESOLVED",
  "FALSE_ALARM",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentSort = "openedAt" | "status" | "driver" | "respondBy";
export type IncidentPeriod = "24h" | "7d" | "30d";
export interface AdminIncident {
  id: string;
  status: IncidentStatus;
  driver: { id: string; firstName: string; lastName: string; email: string };
  openedAt: string;
  respondBy: string | null;
  acknowledgedAt: string | null;
  acknowledgedVia: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolvedVia: string | null;
  eventCount: number;
  notificationCount: number;
}
export interface AdminIncidentStats {
  total: number;
  awaitingResponse: number;
  escalated: number;
  resolved: number;
  falseAlarm: number;
}
export interface AdminIncidentDetail extends AdminIncident {
  timeline: { id: string; kind: string; at: string }[];
  notifications: {
    id: string;
    kind: string;
    channel: string;
    status: string;
    attemptedAt: string;
  }[];
}
export interface IncidentListParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: IncidentStatus;
  period?: IncidentPeriod;
  sortBy: IncidentSort;
  sortDir: "asc" | "desc";
}

export async function listAdminIncidents(params: IncidentListParams) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    sortBy: params.sortBy,
    sortDir: params.sortDir,
  });
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.period) query.set("period", params.period);
  const { data, meta } = await api.getWithMeta<AdminIncident[]>(
    `/admin/incidents?${query}`,
  );
  return { items: data ?? [], totalItems: meta.pagination?.totalItems ?? 0 };
}
export function getAdminIncidentStats() {
  return api.get<AdminIncidentStats>("/admin/incidents/stats");
}
export function getAdminIncident(id: string) {
  return api.get<AdminIncidentDetail>(
    `/admin/incidents/${encodeURIComponent(id)}`,
  );
}

export function incidentReference(id: string) {
  return `INC-${id.slice(-8).toUpperCase()}`;
}
