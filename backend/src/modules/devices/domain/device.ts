export const DeviceStatus = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
} as const;
export type DeviceStatus = (typeof DeviceStatus)[keyof typeof DeviceStatus];

/** An in-cabin detection unit, as seen by administrators. */
export interface DeviceRecord {
  id: string;
  serialNumber: string;
  label: string;
  status: DeviceStatus;
  pairedUserId: string | null;
  /** Display details of the paired driver, for administrators. */
  pairedDriver: { firstName: string; lastName: string; email: string } | null;
  pairedAt: Date | null;
  firmwareVersion: string | null;
  lastSeenAt: Date | null;
  secretRotatedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/** Only the authenticator ever sees the encrypted secret. */
export interface DeviceCredentials {
  id: string;
  serialNumber: string;
  status: DeviceStatus;
  pairedUserId: string | null;
  secretEnc: string;
}

/** The unit behind a verified request. */
export interface AuthenticatedDevice {
  id: string;
  serialNumber: string;
  pairedUserId: string | null;
}

export const DevicePolicy = {
  SERIAL_MAX_LENGTH: 64,
  LABEL_MAX_LENGTH: 100,
  SECRET_BYTES: 32,
  /** A paired unit silent for this long is reported offline to its driver. */
  OFFLINE_AFTER_MS: 10 * 60_000,
} as const;
