import { Global, Module } from '@nestjs/common';
import { UnitOfWork } from '../../common/application/unit-of-work';
import { PrismaTransactionHost } from './prisma-transaction.host';
import { PrismaUnitOfWork } from './prisma-unit-of-work';
import { PrismaService } from './prisma.service';

/**
 * Global on purpose: every bounded context's infrastructure layer needs it.
 * Controllers and application services must NOT inject PrismaService directly;
 * they go through repositories (ports) and UnitOfWork.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    PrismaTransactionHost,
    { provide: UnitOfWork, useClass: PrismaUnitOfWork },
  ],
  exports: [PrismaService, PrismaTransactionHost, UnitOfWork],
})
export class PrismaModule {}
