import type { DeviceCredentials, DeviceRecord, DeviceStatus } from './device';

export interface DeviceListFilter {
  page: number;
  pageSize: number;
  /** Serial number or label. */
  search?: string;
  status?: DeviceStatus;
}

export interface NewDevice {
  serialNumber: string;
  label: string;
  /** Final id, chosen up front: the secret is encrypted bound to it. */
  id: string;
  secretEnc: string;
  createdById: string | null;
}

export type DeviceChanges = Partial<
  Pick<
    DeviceRecord,
    | 'label'
    | 'status'
    | 'pairedUserId'
    | 'pairedAt'
    | 'firmwareVersion'
    | 'lastSeenAt'
    | 'secretRotatedAt'
    | 'revokedAt'
  >
> & { secretEnc?: string; offlineNotifiedAt?: Date | null };

/** Port. */
export abstract class DeviceRepository {
  /** @throws DeviceSerialTakenError */
  abstract create(device: NewDevice): Promise<DeviceRecord>;

  abstract findById(id: string): Promise<DeviceRecord | null>;

  abstract findByPairedUser(userId: string): Promise<DeviceRecord | null>;

  abstract findCredentials(
    serialNumber: string,
  ): Promise<DeviceCredentials | null>;

  abstract list(
    filter: DeviceListFilter,
  ): Promise<{ items: DeviceRecord[]; totalItems: number }>;

  /** @throws DriverAlreadyPairedError when pairing a driver twice. */
  abstract update(id: string, changes: DeviceChanges): Promise<DeviceRecord>;

  /** Stores a request nonce; `false` when it was already used (replay). */
  abstract consumeNonce(
    deviceId: string,
    nonce: string,
    expiresAt: Date,
  ): Promise<boolean>;

  abstract purgeNonces(before: Date): Promise<number>;

  /**
   * Marks paired, active units silent since `silentSince` as reported and
   * returns them, each once per silence (a heartbeat resets the mark).
   */
  abstract claimNewlyOffline(
    silentSince: Date,
    now: Date,
  ): Promise<{ deviceId: string; userId: string }[]>;
}
