import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ClientContext } from '../../../common/application/client-context';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { uuidv7 } from '../../../common/domain/uuid';
import { AuditService } from '../../audit/application/audit.service';
import { AccountState } from '../../users/domain/account-state';
import { Role } from '../../users/domain/role';
import { UserRepository } from '../../users/domain/user.repository';
import {
  type DeviceRecord,
  DevicePolicy,
  DeviceStatus,
} from '../domain/device';
import {
  DeviceNotFoundError,
  DevicePairingTargetError,
  DeviceRevokedError,
} from '../domain/device.errors';
import {
  type DeviceListFilter,
  DeviceRepository,
} from '../domain/device.repository';
import { DeviceSecretCipher } from '../infrastructure/device-secret.cipher';
import type { RuntimeHealth } from '../domain/runtime-health';

/** An administrator in the console, or an operator on the CLI (`adminId: null`). */
export interface DeviceAdminActor {
  adminId: string | null;
  client?: ClientContext;
}

/** Returned once, at registration or rotation: the secret is never readable again. */
export interface DeviceWithSecret {
  device: DeviceRecord;
  /** base64url of 32 random bytes, to load into the unit. */
  secret: string;
}

/** Driver accounts that may carry a unit. */
const PAIRABLE_STATES: readonly AccountState[] = [
  AccountState.PASSWORD_CHANGE_REQUIRED,
  AccountState.PROFILE_SETUP_REQUIRED,
  AccountState.ACTIVE,
];

/**
 * Administrator lifecycle of in-cabin units: register, pair with a driver,
 * unpair, revoke, rotate the signing secret. Administrators never see
 * medical data through this module.
 */
@Injectable()
export class DevicesService {
  constructor(
    private readonly devices: DeviceRepository,
    private readonly users: UserRepository,
    private readonly cipher: DeviceSecretCipher,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditService,
  ) {}

  async register(
    input: { serialNumber: string; label: string },
    actor: DeviceAdminActor,
  ): Promise<DeviceWithSecret> {
    const id = uuidv7();
    const secret = randomBytes(DevicePolicy.SECRET_BYTES);
    const device = await this.unitOfWork.run(async () => {
      const created = await this.devices.create({
        id,
        serialNumber: input.serialNumber.trim(),
        label: input.label.trim(),
        secretEnc: this.cipher.encrypt(secret, id),
        createdById: actor.adminId,
      });
      await this.record('DEVICE_REGISTERED', created.id, actor);
      return created;
    });
    return { device, secret: secret.toString('base64url') };
  }

  list(
    filter: DeviceListFilter,
  ): Promise<{ items: DeviceRecord[]; totalItems: number }> {
    return this.devices.list(filter);
  }

  async get(id: string): Promise<DeviceRecord> {
    const device = await this.devices.findById(id);
    if (!device) throw new DeviceNotFoundError();
    return device;
  }

  /** The unit paired with a driver, if any. */
  pairedWith(userId: string): Promise<DeviceRecord | null> {
    return this.devices.findByPairedUser(userId);
  }

  async pair(
    id: string,
    userId: string,
    actor: DeviceAdminActor,
  ): Promise<DeviceRecord> {
    const device = await this.get(id);
    if (device.status === DeviceStatus.REVOKED) throw new DeviceRevokedError();
    const user = await this.users.findById(userId);
    if (
      !user ||
      user.role !== Role.DRIVER ||
      !PAIRABLE_STATES.includes(user.accountState)
    ) {
      throw new DevicePairingTargetError();
    }
    if (device.pairedUserId === userId) return device;

    return this.unitOfWork.run(async () => {
      const paired = await this.devices.update(id, {
        associationId: uuidv7(),
        runtimeHealth: null,
        pairedUserId: userId,
        pairedAt: new Date(),
      });
      await this.record('DEVICE_PAIRED', id, actor, { userId });
      return paired;
    });
  }

  async unpair(id: string, actor: DeviceAdminActor): Promise<DeviceRecord> {
    const device = await this.get(id);
    if (!device.pairedUserId) return device;
    return this.unitOfWork.run(async () => {
      const unpaired = await this.devices.update(id, {
        associationId: uuidv7(),
        runtimeHealth: null,
        pairedUserId: null,
        pairedAt: null,
      });
      await this.record('DEVICE_UNPAIRED', id, actor, {
        userId: device.pairedUserId,
      });
      return unpaired;
    });
  }

  /** Permanent: the unit can no longer authenticate and is unpaired. */
  async revoke(id: string, actor: DeviceAdminActor): Promise<DeviceRecord> {
    const device = await this.get(id);
    if (device.status === DeviceStatus.REVOKED) return device;
    return this.unitOfWork.run(async () => {
      const revoked = await this.devices.update(id, {
        associationId: uuidv7(),
        runtimeHealth: null,
        status: DeviceStatus.REVOKED,
        revokedAt: new Date(),
        pairedUserId: null,
        pairedAt: null,
      });
      await this.record('DEVICE_REVOKED', id, actor);
      return revoked;
    });
  }

  /** The previous secret stops working immediately. */
  async rotateSecret(
    id: string,
    actor: DeviceAdminActor,
  ): Promise<DeviceWithSecret> {
    const device = await this.get(id);
    if (device.status === DeviceStatus.REVOKED) throw new DeviceRevokedError();
    const secret = randomBytes(DevicePolicy.SECRET_BYTES);
    const rotated = await this.unitOfWork.run(async () => {
      const updated = await this.devices.update(id, {
        secretEnc: this.cipher.encrypt(secret, id),
        secretRotatedAt: new Date(),
      });
      await this.record('DEVICE_SECRET_ROTATED', id, actor);
      return updated;
    });
    return { device: rotated, secret: secret.toString('base64url') };
  }

  /** Called by the unit itself; no audit entry (frequent, non-sensitive). */
  async heartbeat(
    deviceId: string,
    firmwareVersion: string | undefined,
    runtimeHealth?: RuntimeHealth,
  ): Promise<void> {
    await this.devices.update(deviceId, {
      lastSeenAt: new Date(),
      // Back online: the next silence is reported again.
      offlineNotifiedAt: null,
      ...(firmwareVersion ? { firmwareVersion } : {}),
      runtimeHealth: runtimeHealth ?? null,
    });
  }

  private record(
    action:
      | 'DEVICE_REGISTERED'
      | 'DEVICE_PAIRED'
      | 'DEVICE_UNPAIRED'
      | 'DEVICE_REVOKED'
      | 'DEVICE_SECRET_ROTATED',
    deviceId: string,
    actor: DeviceAdminActor,
    metadata?: Record<string, string | null>,
  ): Promise<void> {
    return this.audit.record({
      action,
      actor: actor.adminId
        ? { type: 'USER', userId: actor.adminId }
        : { type: 'CLI' },
      target: { type: 'DEVICE', id: deviceId },
      client: actor.client,
      metadata,
    });
  }
}
