import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import { HeartRhythm, type Vitals } from '../domain/safety';
import {
  type MedicalEventFilter,
  type MedicalEventRecord,
  MedicalEventRepository,
  type NewMedicalEvent,
} from '../domain/safety.repository';

const EVENT_SELECT = {
  id: true,
  userId: true,
  deviceId: true,
  incidentId: true,
  source: true,
  type: true,
  severity: true,
  clientEventId: true,
  confidence: true,
  detection: true,
  payloadHash: true,
  detectedAt: true,
  receivedAt: true,
  vitals: true,
  latitude: true,
  longitude: true,
  locationAccuracyM: true,
} as const satisfies Prisma.MedicalEventSelect;

type EventRow = Prisma.MedicalEventGetPayload<{ select: typeof EVENT_SELECT }>;

const NUMERIC_VITALS = [
  'heartRateBpm',
  'spo2Percent',
  'respiratoryRateBpm',
  'eyeClosurePercent',
] as const;
const RHYTHMS = new Set<string>(Object.values(HeartRhythm));

/** Reads back only the readings this version knows; ignores anything else. */
function toVitals(value: Prisma.JsonValue): Vitals | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const vitals: Vitals = {};
  for (const key of NUMERIC_VITALS) {
    const reading = value[key];
    if (typeof reading === 'number') vitals[key] = reading;
  }
  const rhythm = value.rhythm;
  if (typeof rhythm === 'string' && RHYTHMS.has(rhythm)) {
    vitals.rhythm = rhythm as HeartRhythm;
  }
  return Object.keys(vitals).length ? vitals : null;
}

function toRecord(row: EventRow): MedicalEventRecord {
  const {
    latitude,
    longitude,
    locationAccuracyM,
    vitals,
    detection,
    ...event
  } = row;
  return {
    ...event,
    detection: detection as unknown as MedicalEventRecord['detection'],
    vitals: toVitals(vitals),
    location:
      latitude !== null && longitude !== null
        ? { latitude, longitude, accuracyM: locationAccuracyM }
        : null,
  };
}

@Injectable()
export class PrismaMedicalEventRepository extends MedicalEventRepository {
  constructor(private readonly db: PrismaTransactionHost) {
    super();
  }

  async findByClientId(
    userId: string,
    clientEventId: string,
  ): Promise<MedicalEventRecord | null> {
    const row = await this.db.client.medicalEvent.findUnique({
      where: { userId_clientEventId: { userId, clientEventId } },
      select: EVENT_SELECT,
    });
    return row ? toRecord(row) : null;
  }

  async create(event: NewMedicalEvent): Promise<MedicalEventRecord> {
    const { location, vitals, detection, ...columns } = event;
    const row = await this.db.client.medicalEvent.create({
      data: {
        ...columns,
        detection: detection ? { ...detection } : Prisma.DbNull,
        vitals: vitals ? { ...vitals } : Prisma.DbNull,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        locationAccuracyM: location?.accuracyM ?? null,
      },
      select: EVENT_SELECT,
    });
    return toRecord(row);
  }

  async findOwn(
    userId: string,
    eventId: string,
  ): Promise<MedicalEventRecord | null> {
    const row = await this.db.client.medicalEvent.findFirst({
      where: { id: eventId, userId },
      select: EVENT_SELECT,
    });
    return row ? toRecord(row) : null;
  }

  async listOwn(
    userId: string,
    filter: MedicalEventFilter,
  ): Promise<{ items: MedicalEventRecord[]; totalItems: number }> {
    const where = {
      userId,
      ...(filter.type ? { type: filter.type } : {}),
    } satisfies Prisma.MedicalEventWhereInput;
    const [rows, totalItems] = await Promise.all([
      this.db.client.medicalEvent.findMany({
        where,
        select: EVENT_SELECT,
        orderBy: [{ detectedAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.db.client.medicalEvent.count({ where }),
    ]);
    return { items: rows.map(toRecord), totalItems };
  }

  async latestOwn(userId: string): Promise<MedicalEventRecord | null> {
    const row = await this.db.client.medicalEvent.findFirst({
      where: { userId },
      select: EVENT_SELECT,
      orderBy: [{ detectedAt: 'desc' }, { id: 'desc' }],
    });
    return row ? toRecord(row) : null;
  }

  async listForIncident(incidentId: string): Promise<MedicalEventRecord[]> {
    const rows = await this.db.client.medicalEvent.findMany({
      where: { incidentId },
      select: EVENT_SELECT,
      orderBy: [{ detectedAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toRecord);
  }

  async deleteReceivedBefore(before: Date): Promise<number> {
    const { count } = await this.db.client.medicalEvent.deleteMany({
      where: { receivedAt: { lt: before } },
    });
    return count;
  }
}
