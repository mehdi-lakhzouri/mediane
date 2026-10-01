import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../common/application/unit-of-work';
import { PrismaTransactionHost } from './prisma-transaction.host';

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly host: PrismaTransactionHost) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.host.runInTransaction(work);
  }
}
