import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import {
  AdminIncidentRepository,
  type AdminIncidentFilter,
  type AdminIncidentStats,
} from '../domain/admin-incident.repository';

const SELECT = {
  id: true,
  status: true,
  openedAt: true,
  respondBy: true,
  acknowledgedAt: true,
  acknowledgedVia: true,
  escalatedAt: true,
  resolvedAt: true,
  resolvedVia: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  _count: { select: { events: true, notifications: true } },
} as const satisfies Prisma.IncidentSelect;

function present(row: Prisma.IncidentGetPayload<{ select: typeof SELECT }>) {
  const { user, _count, ...incident } = row;
  return {
    ...incident,
    driver: user,
    eventCount: _count.events,
    notificationCount: _count.notifications,
  };
}

@Injectable()
export class PrismaAdminIncidentRepository extends AdminIncidentRepository {
  constructor(private readonly db: PrismaTransactionHost) {
    super();
  }

  async list(filter: AdminIncidentFilter) {
    const search = filter.search?.trim();
    const driverSearch: Prisma.IncidentWhereInput[] = (
      search?.split(/\s+/) ?? []
    ).map((token) => ({
      user: {
        OR: [
          { firstName: { contains: token, mode: 'insensitive' } },
          { lastName: { contains: token, mode: 'insensitive' } },
          { email: { contains: token, mode: 'insensitive' } },
        ],
      },
    }));
    const days = filter.period === '24h' ? 1 : filter.period === '7d' ? 7 : 30;
    const where: Prisma.IncidentWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.period
        ? { openedAt: { gte: new Date(Date.now() - days * 86_400_000) } }
        : {}),
      ...(search
        ? {
            OR: [
              {
                AND: driverSearch,
              },
              ...(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                search,
              )
                ? [{ id: search }]
                : []),
            ],
          }
        : {}),
    };
    const direction = filter.sortDir ?? 'desc';
    const orderBy: Prisma.IncidentOrderByWithRelationInput =
      filter.sortBy === 'driver'
        ? { user: { lastName: direction } }
        : filter.sortBy === 'status'
          ? { status: direction }
          : filter.sortBy === 'respondBy'
            ? { respondBy: { sort: direction, nulls: 'last' } }
            : { openedAt: direction };
    const [rows, totalItems] = await Promise.all([
      this.db.client.incident.findMany({
        where,
        select: SELECT,
        orderBy: [orderBy, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.db.client.incident.count({ where }),
    ]);
    return { items: rows.map(present), totalItems };
  }

  async stats(): Promise<AdminIncidentStats> {
    const groups = await this.db.client.incident.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const count = (status: string) =>
      groups.find((group) => group.status === status)?._count._all ?? 0;
    return {
      total: groups.reduce((sum, group) => sum + group._count._all, 0),
      awaitingResponse: count('AWAITING_RESPONSE'),
      escalated: count('ESCALATED'),
      resolved: count('RESOLVED'),
      falseAlarm: count('FALSE_ALARM'),
    };
  }

  async detail(id: string) {
    const result = await this.db.client.incident.findUnique({
      where: { id },
      select: {
        ...SELECT,
        timeline: {
          select: { id: true, kind: true, at: true },
          orderBy: [{ at: 'asc' }, { id: 'asc' }],
        },
        notifications: {
          select: {
            id: true,
            kind: true,
            channel: true,
            status: true,
            attemptedAt: true,
          },
          orderBy: [{ attemptedAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!result) return null;
    const { timeline, notifications, ...row } = result;
    return { ...present(row), timeline, notifications };
  }
}
