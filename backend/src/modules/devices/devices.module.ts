import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { DeviceHealthMonitor } from './application/device-health.monitor';
import { DeviceAuthenticator } from './application/device-authenticator';
import { DevicesService } from './application/devices.service';
import { DeviceRepository } from './domain/device.repository';
import { DeviceSecretCipher } from './infrastructure/device-secret.cipher';
import { PrismaDeviceRepository } from './infrastructure/prisma-device.repository';
import { AdminDevicesController } from './presentation/admin-devices.controller';
import { DeviceAuthGuard } from './presentation/device-auth.guard';
import { DeviceController } from './presentation/device.controller';

/**
 * In-cabin units: administrator lifecycle and signed device authentication.
 * The safety module builds on DeviceAuthGuard for event reporting.
 */
@Module({
  imports: [UsersModule, AuditModule, NotificationsModule],
  controllers: [AdminDevicesController, DeviceController],
  providers: [
    DevicesService,
    DeviceAuthenticator,
    DeviceAuthGuard,
    DeviceHealthMonitor,
    DeviceSecretCipher,
    { provide: DeviceRepository, useClass: PrismaDeviceRepository },
  ],
  exports: [
    DevicesService,
    DeviceHealthMonitor,
    DeviceAuthenticator,
    DeviceAuthGuard,
    DeviceRepository,
  ],
})
export class DevicesModule {}
