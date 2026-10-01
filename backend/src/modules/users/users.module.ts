import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SecurityModule } from '../security/security.module';
import { BootstrapAdminService } from './application/bootstrap-admin.service';
import { UserRepository } from './domain/user.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';

/**
 * Users bounded context (identity + lifecycle). No controller of its own:
 * users are exposed through admin/ (management) and profiles/ (self-service).
 */
@Module({
  imports: [SecurityModule, AuditModule],
  providers: [
    BootstrapAdminService,
    { provide: UserRepository, useClass: PrismaUserRepository },
  ],
  exports: [UserRepository, BootstrapAdminService],
})
export class UsersModule {}
