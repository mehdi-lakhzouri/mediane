import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { DevicePolicy } from '../domain/device';
import { DeviceRepository } from '../domain/device.repository';

/**
 * Tells drivers when their paired unit goes quiet: once per silence, so a
 * unit left unplugged overnight does not produce a notification every tick.
 * Units that never reported are not "offline", just not installed yet.
 */
@Injectable()
export class DeviceHealthMonitor {
  constructor(
    private readonly devices: DeviceRepository,
    private readonly notifications: NotificationsService,
  ) {}

  /** @returns how many drivers were told. */
  async reportOffline(now: Date = new Date()): Promise<number> {
    const silent = await this.devices.claimNewlyOffline(
      new Date(now.getTime() - DevicePolicy.OFFLINE_AFTER_MS),
      now,
    );
    for (const { userId } of silent) {
      await this.notifications.notify(userId, { type: 'CABIN_UNIT_OFFLINE' });
    }
    return silent.length;
  }
}
