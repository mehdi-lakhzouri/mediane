import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';

export type PrismaDb = Prisma.TransactionClient;

/**
 * Repositories always go through `client`: inside a UnitOfWork it is the
 * transaction client (propagated with AsyncLocalStorage), otherwise the root client.
 * This keeps transaction plumbing out of the application layer.
 */
@Injectable()
export class PrismaTransactionHost {
  private readonly storage = new AsyncLocalStorage<PrismaDb>();

  constructor(private readonly prisma: PrismaService) {}

  get client(): PrismaDb {
    return this.storage.getStore() ?? this.prisma;
  }

  runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.storage.getStore()) return work();
    return this.prisma.$transaction((tx) => this.storage.run(tx, work));
  }
}
