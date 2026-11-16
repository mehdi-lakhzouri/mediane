import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { isUniqueConstraintViolation } from '../../../infrastructure/prisma/prisma-errors';
import { PrismaTransactionHost } from '../../../infrastructure/prisma/prisma-transaction.host';
import type { DeviceCredentials, DeviceRecord } from '../domain/device';
import {
  DeviceNotFoundError,
  DeviceSerialTakenError,
  DriverAlreadyPairedError,
} from '../domain/device.errors';
import {
  DeviceChanges,
  DeviceListFilter,
  DeviceRepository,
  NewDevice,
} from '../domain/device.repository';

const RECORD_SELECT = {
  id: true,
  serialNumber: true,
  label: true,
  status: true,
  pairedUserId: true,
  pairedAt: true,
  firmwareVersion: true,
  associationId: true,
  runtimeHealth: true,
  lastSeenAt: true,
  secretRotatedAt: true,
  revokedAt: true,
  createdAt: true,
  pairedUser: { select: { firstName: true, lastName: true, email: true } },
} as const satisfies Prisma.VehicleDeviceSelect;

type DeviceRow = Prisma.VehicleDeviceGetPayload<{
  select: typeof RECORD_SELECT;
}>;

function toRecord(row: DeviceRow): DeviceRecord {
  const { pairedUser, ...device } = row;
  return {
    ...device,
    runtimeHealth:
      device.runtimeHealth as unknown as DeviceRecord['runtimeHealth'],
    pairedDriver: pairedUser,
  };
}

function toRecordOrNull(row: DeviceRow | null): DeviceRecord | null {
  return row ? toRecord(row) : null;
}

@Injectable()
export class PrismaDeviceRepository extends DeviceRepository {
  constructor(private readonly db: PrismaTransactionHost) {
    super();
  }

  async lock(id: string): Promise<void> {
    await this.db.client
      .$queryRaw`SELECT "id" FROM "vehicle_devices" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }

  async create(device: NewDevice): Promise<DeviceRecord> {
    try {
      return toRecord(
        await this.db.client.vehicleDevice.create({
          data: device,
          select: RECORD_SELECT,
        }),
      );
    } catch (error) {
      if (isUniqueConstraintViolation(error))
        throw new DeviceSerialTakenError();
      throw error;
    }
  }

  async findById(id: string): Promise<DeviceRecord | null> {
    return toRecordOrNull(
      await this.db.client.vehicleDevice.findUnique({
        where: { id },
        select: RECORD_SELECT,
      }),
    );
  }

  async findByPairedUser(userId: string): Promise<DeviceRecord | null> {
    return toRecordOrNull(
      await this.db.client.vehicleDevice.findUnique({
        where: { pairedUserId: userId },
        select: RECORD_SELECT,
      }),
    );
  }

  findCredentials(serialNumber: string): Promise<DeviceCredentials | null> {
    return this.db.client.vehicleDevice.findUnique({
      where: { serialNumber },
      select: {
        id: true,
        serialNumber: true,
        status: true,
        pairedUserId: true,
        secretEnc: true,
      },
    });
  }

  async list(
    filter: DeviceListFilter,
  ): Promise<{ items: DeviceRecord[]; totalItems: number }> {
    const search = filter.search?.trim();
    const where: Prisma.VehicleDeviceWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(search
        ? {
            OR: [
              { serialNumber: { contains: search, mode: 'insensitive' } },
              { label: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, totalItems] = await Promise.all([
      this.db.client.vehicleDevice.findMany({
        where,
        select: RECORD_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.db.client.vehicleDevice.count({ where }),
    ]);
    return { items: rows.map(toRecord), totalItems };
  }

  async update(id: string, changes: DeviceChanges): Promise<DeviceRecord> {
    try {
      return toRecord(
        await this.db.client.vehicleDevice.update({
          where: { id },
          data: {
            ...changes,
            runtimeHealth:
              changes.runtimeHealth === null
                ? Prisma.DbNull
                : changes.runtimeHealth
                  ? { ...changes.runtimeHealth }
                  : undefined,
          },
          select: RECORD_SELECT,
        }),
      );
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new DriverAlreadyPairedError();
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new DeviceNotFoundError();
      }
      throw error;
    }
  }

  async consumeNonce(
    deviceId: string,
    nonce: string,
    expiresAt: Date,
  ): Promise<boolean> {
    try {
      await this.db.client.deviceRequestNonce.create({
        data: { deviceId, nonce, expiresAt },
      });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  async claimNewlyOffline(
    silentSince: Date,
    now: Date,
  ): Promise<{ deviceId: string; userId: string }[]> {
    const utc = (date: Date) =>
      Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
    const rows = await this.db.client.$queryRaw<
      { id: string; pairedUserId: string }[]
    >`
      UPDATE "vehicle_devices"
      SET "offlineNotifiedAt" = ${utc(now)}
      WHERE "status" = 'ACTIVE'
        AND "pairedUserId" IS NOT NULL
        AND "lastSeenAt" < ${utc(silentSince)}
        AND "offlineNotifiedAt" IS NULL
      RETURNING "id", "pairedUserId"`;
    return rows.map((row) => ({ deviceId: row.id, userId: row.pairedUserId }));
  }

  async purgeNonces(before: Date): Promise<number> {
    const { count } = await this.db.client.deviceRequestNonce.deleteMany({
      where: { expiresAt: { lt: before } },
    });
    return count;
  }
}
