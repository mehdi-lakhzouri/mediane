import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { FamiliesModule } from '../families/families.module';
import { MfaModule } from '../mfa/mfa.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { SafetyModule } from '../safety/safety.module';
import { UsersModule } from '../users/users.module';
import { MobileBootstrapService } from './application/mobile-bootstrap.service';
import { MobileDashboardService } from './application/mobile-dashboard.service';
import { MobileController } from './presentation/mobile.controller';

@Module({
  imports: [
    UsersModule,
    ProfilesModule,
    FamiliesModule,
    MfaModule,
    DevicesModule,
    SafetyModule,
    NotificationsModule,
  ],
  controllers: [MobileController],
  providers: [MobileBootstrapService, MobileDashboardService],
})
export class MobileModule {}
