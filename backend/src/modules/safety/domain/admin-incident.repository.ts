import type { IncidentStatus, IncidentTimelineKind } from './incident';
import type {
  NotificationChannel,
  NotificationKind,
  NotificationStatus,
} from './notification';
import type { IncidentActorChannel } from './safety';

/** Administrator projection: response operations, never medical evidence or recipient identity. */
export interface AdminIncidentView {
  id: string;
  status: IncidentStatus;
  openedAt: Date;
  respondBy: Date | null;
  acknowledgedAt: Date | null;
  acknowledgedVia: IncidentActorChannel | null;
  escalatedAt: Date | null;
  resolvedAt: Date | null;
  resolvedVia: IncidentActorChannel | null;
  driver: { id: string; firstName: string; lastName: string; email: string };
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

export interface AdminIncidentDetail extends AdminIncidentView {
  timeline: { id: string; kind: IncidentTimelineKind; at: Date }[];
  notifications: {
    id: string;
    kind: NotificationKind;
    channel: NotificationChannel;
    status: NotificationStatus;
    attemptedAt: Date;
  }[];
}

export const ADMIN_INCIDENT_SORTS = [
  'openedAt',
  'status',
  'driver',
  'respondBy',
] as const;
export interface AdminIncidentFilter {
  page: number;
  pageSize: number;
  search?: string;
  status?: IncidentStatus;
  period?: '24h' | '7d' | '30d';
  sortBy?: (typeof ADMIN_INCIDENT_SORTS)[number];
  sortDir?: 'asc' | 'desc';
}

export abstract class AdminIncidentRepository {
  abstract list(
    filter: AdminIncidentFilter,
  ): Promise<{ items: AdminIncidentView[]; totalItems: number }>;
  abstract stats(): Promise<AdminIncidentStats>;
  abstract detail(id: string): Promise<AdminIncidentDetail | null>;
}
