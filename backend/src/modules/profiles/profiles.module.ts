import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { ProfilesService } from './application/profiles.service';
import { UserProfileRepository } from './domain/user-profile.repository';
import { PrismaUserProfileRepository } from './infrastructure/prisma-user-profile.repository';
import { ProfileController } from './presentation/profile.controller';

@Module({
  imports: [UsersModule, AuditModule],
  controllers: [ProfileController],
  providers: [
    ProfilesService,
    { provide: UserProfileRepository, useClass: PrismaUserProfileRepository },
  ],
})
export class ProfilesModule {}
