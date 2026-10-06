import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/application/audit.service';
import {
  categoryForAuditAction,
  type AuditCategory,
} from '../../audit/domain/audit-category';
import type {
  AuditListFilter,
  AuditLogViewRecord,
  AuditStatsRecord,
} from '../../audit/domain/audit-log.repository';
import { UserRepository } from '../../users/domain/user.repository';

export interface AdminAuditView extends AuditLogViewRecord {
  category: AuditCategory;
  actor: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

@Injectable()
export class AdminAuditQueryService {
  constructor(
    private readonly audit: AuditService,
    private readonly users: UserRepository,
  ) {}

  async list(
    filter: AuditListFilter,
  ): Promise<{ items: AdminAuditView[]; totalItems: number }> {
    const page = await this.audit.list(filter);
    const actorIds = Array.from(
      new Set(
        page.items
          .map((entry) => entry.actorUserId)
          .filter((id): id is string => id !== null),
      ),
    );
    const users = await this.users.findManyByIdsIncludingDeleted(actorIds);
    const actors = new Map(
      users.map((user) => [
        user.id,
        {
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email.value,
        },
      ]),
    );

    return {
      totalItems: page.totalItems,
      items: page.items.map((entry) => ({
        ...entry,
        category: categoryForAuditAction(entry.action),
        actor: entry.actorUserId
          ? (actors.get(entry.actorUserId) ?? null)
          : null,
      })),
    };
  }

  stats(): Promise<AuditStatsRecord> {
    return this.audit.stats();
  }
}
