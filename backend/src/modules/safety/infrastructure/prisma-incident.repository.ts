import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import {
  ACTIVE_INCIDENT_STATUSES,
  type IncidentRecord,
  IncidentStatus,
  type IncidentTimelineKind,
  type TimelineEntry,
} from '../domain/incident';
import type {
  NotificationAttempt,
  NotificationRecord,
} from '../domain/notification';
import type { IncidentActorChannel } from '../domain/safety';
import {
  type DispatchClaim,
  type IncidentChanges,
  IncidentRepository,
  type NewIncident,
} from '../domain/safety.repository';

const INCIDENT_SELECT = {
  id: true,
  userId: true,
  status: true,
  severity: true,
  triggerType: true,
  openedAt: true,
  respondBy: true,
  acknowledgedAt: true,
  acknowledgedVia: true,
  escalatedAt: true,
  resolvedAt: true,
  resolvedVia: true,
  latitude: true,
  longitude: true,
  locationAccuracyM: true,
} as const satisfies Prisma.IncidentSelect;

type IncidentRow = Prisma.IncidentGetPayload<{
  select: typeof INCIDENT_SELECT;
}>;

function toRecord(row: IncidentRow): IncidentRecord {
  const { latitude, longitude, locationAccuracyM, ...incident } = row;
  return {
    ...incident,
    location:
      latitude !== null && longitude !== null
        ? { latitude, longitude, accuracyM: locationAccuracyM }
        : null,
  };
}

function toColumns(
  changes: IncidentChanges,
): Prisma.IncidentUncheckedUpdateManyInput {
  const { location, ...rest } = changes;
  if (location === undefined) return rest;
  return {
    ...rest,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    locationAccuracyM: location?.accuracyM ?? null,
  };
}

/**
 * A UTC timestamp for raw SQL. Columns are `timestamp(3)` holding UTC wall
 * time (as Prisma writes them); converting explicitly keeps comparisons
 * correct whatever the session time zone.
 */
function utc(date: Date): Prisma.Sql {
  return Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

const ACTIVE = [...ACTIVE_INCIDENT_STATUSES];

@Injectable()
export class PrismaIncidentRepository extends IncidentRepository {
  constructor(private readonly db: PrismaTransactionHost) {
    super();
  }

  async lockDriver(userId: string): Promise<void> {
    // Transaction-scoped advisory lock: no row is held, so sign-in and
    // profile updates for the same user are never blocked.
    await this.db.client.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`safety:${userId}`}, 0))`;
  }

  async findActive(userId: string): Promise<IncidentRecord | null> {
    const row = await this.db.client.incident.findFirst({
      where: { userId, status: { in: ACTIVE } },
      select: INCIDENT_SELECT,
    });
    return row ? toRecord(row) : null;
  }

  async findById(incidentId: string): Promise<IncidentRecord | null> {
    const row = await this.db.client.incident.findUnique({
      where: { id: incidentId },
      select: INCIDENT_SELECT,
    });
    return row ? toRecord(row) : null;
  }

  async findOwn(
    userId: string,
    incidentId: string,
  ): Promise<IncidentRecord | null> {
    const row = await this.db.client.incident.findFirst({
      where: { id: incidentId, userId },
      select: INCIDENT_SELECT,
    });
    return row ? toRecord(row) : null;
  }

  async listOwn(
    userId: string,
    filter: { page: number; pageSize: number },
  ): Promise<{ items: IncidentRecord[]; totalItems: number }> {
    const where = { userId } satisfies Prisma.IncidentWhereInput;
    const [rows, totalItems] = await Promise.all([
      this.db.client.incident.findMany({
        where,
        select: INCIDENT_SELECT,
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.db.client.incident.count({ where }),
    ]);
    return { items: rows.map(toRecord), totalItems };
  }

  async listEscalatedForUsers(
    userIds: readonly string[],
    since: Date,
  ): Promise<IncidentRecord[]> {
    const rows = await this.db.client.incident.findMany({
      where: {
        userId: { in: [...userIds] },
        escalatedAt: { not: null },
        OR: [
          { status: IncidentStatus.ESCALATED },
          { openedAt: { gte: since } },
        ],
      },
      select: INCIDENT_SELECT,
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return rows.map(toRecord);
  }

  async create(incident: NewIncident): Promise<IncidentRecord> {
    const { location, ...columns } = incident;
    const row = await this.db.client.incident.create({
      data: {
        ...columns,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        locationAccuracyM: location?.accuracyM ?? null,
      },
      select: INCIDENT_SELECT,
    });
    return toRecord(row);
  }

  async transition(
    incidentId: string,
    from: readonly IncidentStatus[],
    changes: IncidentChanges,
  ): Promise<IncidentRecord | null> {
    const { count } = await this.db.client.incident.updateMany({
      where: { id: incidentId, status: { in: [...from] } },
      data: toColumns(changes),
    });
    return count ? this.findById(incidentId) : null;
  }

  async addTimeline(
    incidentId: string,
    kind: IncidentTimelineKind,
    at: Date,
    detail?: TimelineEntry['detail'],
  ): Promise<void> {
    await this.db.client.incidentTimelineEntry.create({
      data: { incidentId, kind, at, ...(detail ? { detail } : {}) },
    });
  }

  async listTimeline(incidentId: string): Promise<TimelineEntry[]> {
    const rows = await this.db.client.incidentTimelineEntry.findMany({
      where: { incidentId },
      select: { kind: true, at: true, detail: true },
      orderBy: [{ at: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      kind: row.kind,
      at: row.at,
      detail: (row.detail as TimelineEntry['detail']) ?? null,
    }));
  }

  async escalateOverdue(now: Date, limit: number): Promise<IncidentRecord[]> {
    const claimed = await this.db.client.$queryRaw<{ id: string }[]>`
      UPDATE "incidents"
      SET "status" = 'ESCALATED', "escalatedAt" = ${utc(now)},
          "respondBy" = NULL, "updatedAt" = ${utc(now)}
      WHERE "id" IN (
        SELECT "id" FROM "incidents"
        WHERE "status" = 'AWAITING_RESPONSE' AND "respondBy" <= ${utc(now)}
        ORDER BY "respondBy"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id"`;
    return this.findMany(claimed.map((row) => row.id));
  }

  async claimDispatch(
    now: Date,
    leaseUntil: Date,
    limit: number,
  ): Promise<DispatchClaim[]> {
    // Alerts: escalated, not yet delivered. All-clears: resolved by the
    // driver after alerts went out. A system auto-close sends nothing.
    const claimed = await this.db.client.$queryRaw<
      { id: string; status: IncidentStatus }[]
    >`
      UPDATE "incidents"
      SET "dispatchLeaseUntil" = ${utc(leaseUntil)}
      WHERE "id" IN (
        SELECT "id" FROM "incidents"
        WHERE (
          ("status" = 'ESCALATED' AND "alertsSentAt" IS NULL)
          OR ("status" = 'RESOLVED' AND "alertsSentAt" IS NOT NULL
              AND "allClearSentAt" IS NULL AND "resolvedVia" <> 'SYSTEM')
        )
        AND ("dispatchLeaseUntil" IS NULL OR "dispatchLeaseUntil" < ${utc(now)})
        ORDER BY "updatedAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "status"`;
    const incidents = await this.findMany(claimed.map((row) => row.id));
    return incidents.map((incident) => ({
      incident,
      kind:
        incident.status === IncidentStatus.ESCALATED ? 'ALERT' : 'ALL_CLEAR',
    }));
  }

  async completeDispatch(
    incidentId: string,
    kind: DispatchClaim['kind'],
    at: Date,
  ): Promise<void> {
    await this.db.client.incident.update({
      where: { id: incidentId },
      data: {
        ...(kind === 'ALERT' ? { alertsSentAt: at } : { allClearSentAt: at }),
        dispatchLeaseUntil: null,
      },
    });
  }

  async autoClose(
    escalatedBefore: Date,
    now: Date,
    via: IncidentActorChannel,
  ): Promise<{ id: string; userId: string }[]> {
    const closed = await this.db.client.$queryRaw<
      { id: string; userId: string }[]
    >`
      UPDATE "incidents"
      SET "status" = 'RESOLVED', "resolvedAt" = ${utc(now)},
          "resolvedVia" = ${via}::"IncidentActorChannel", "updatedAt" = ${utc(now)}
      WHERE "status" = 'ESCALATED' AND "escalatedAt" < ${utc(escalatedBefore)}
      RETURNING "id", "userId"`;
    return closed;
  }

  async addNotifications(
    incidentId: string,
    attempts: readonly NotificationAttempt[],
  ): Promise<void> {
    if (attempts.length === 0) return;
    await this.db.client.incidentNotification.createMany({
      data: attempts.map((attempt) => ({ ...attempt, incidentId })),
    });
  }

  listNotifications(incidentId: string): Promise<NotificationRecord[]> {
    return this.db.client.incidentNotification.findMany({
      where: { incidentId },
      select: {
        id: true,
        kind: true,
        recipientType: true,
        recipientUserId: true,
        recipientName: true,
        priority: true,
        channel: true,
        status: true,
        error: true,
        attemptedAt: true,
      },
      orderBy: [{ attemptedAt: 'asc' }, { id: 'asc' }],
    });
  }

  async deleteOpenedBefore(before: Date): Promise<number> {
    const { count } = await this.db.client.incident.deleteMany({
      where: { openedAt: { lt: before }, status: { notIn: ACTIVE } },
    });
    return count;
  }

  async clearLocationsOpenedBefore(before: Date): Promise<number> {
    const { count } = await this.db.client.incident.updateMany({
      where: {
        openedAt: { lt: before },
        status: { notIn: ACTIVE },
        latitude: { not: null },
      },
      data: { latitude: null, longitude: null, locationAccuracyM: null },
    });
    return count;
  }

  private async findMany(ids: string[]): Promise<IncidentRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.client.incident.findMany({
      where: { id: { in: ids } },
      select: INCIDENT_SELECT,
    });
    return rows.map(toRecord);
  }
}
