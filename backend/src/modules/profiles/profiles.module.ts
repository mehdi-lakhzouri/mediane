import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { AvatarImageProcessor } from './application/avatar-image-processor';
import { ProfilesService } from './application/profiles.service';
import { UserProfileRepository } from './domain/user-profile.repository';
import { PrismaUserProfileRepository } from './infrastructure/prisma-user-profile.repository';
import { SharpAvatarImageProcessor } from './infrastructure/sharp-avatar-image.processor';
import { ProfileController } from './presentation/profile.controller';

@Module({
  imports: [UsersModule, AuditModule, StorageModule],
  controllers: [ProfileController],
  providers: [
    ProfilesService,
    { provide: UserProfileRepository, useClass: PrismaUserProfileRepository },
    { provide: AvatarImageProcessor, useClass: SharpAvatarImageProcessor },
  ],
  // Account hard deletion (admin) also removes the stored photo.
  exports: [ProfilesService],
})
export class ProfilesModule {}
