import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';
import { FamiliesService } from './application/families.service';
import { FamilyRepository } from './domain/family.repository';
import { PrismaFamilyRepository } from './infrastructure/prisma-family.repository';
import { AdminFamiliesController } from './presentation/admin-families.controller';
import { FamiliesController } from './presentation/families.controller';

/**
 * Families of drivers (mobile) and their management (console). Exports the
 * service so account lifecycle changes (suspension, deletion) can detach a
 * driver from their family.
 */
@Module({
  imports: [UsersModule, ProfilesModule, AuditModule, NotificationsModule],
  controllers: [FamiliesController, AdminFamiliesController],
  providers: [
    FamiliesService,
    { provide: FamilyRepository, useClass: PrismaFamilyRepository },
  ],
  exports: [FamiliesService],
})
export class FamiliesModule {}
