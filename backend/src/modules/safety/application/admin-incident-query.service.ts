import { Injectable } from '@nestjs/common';
import {
  AdminIncidentRepository,
  type AdminIncidentFilter,
} from '../domain/admin-incident.repository';
import { IncidentNotFoundError } from '../domain/safety.errors';

@Injectable()
export class AdminIncidentQueryService {
  constructor(private readonly incidents: AdminIncidentRepository) {}
  list(filter: AdminIncidentFilter) {
    return this.incidents.list(filter);
  }
  stats() {
    return this.incidents.stats();
  }
  async detail(id: string) {
    const detail = await this.incidents.detail(id);
    if (!detail) throw new IncidentNotFoundError();
    return detail;
  }
}
