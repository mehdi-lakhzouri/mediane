import { Injectable } from '@nestjs/common';
import {
  type IncidentRecord,
  IncidentStatus,
  isActiveIncident,
  type TimelineEntry,
} from '../domain/incident';
import {
  type NotificationRecord,
  SafetyDirectory,
} from '../domain/notification';
import type { GeoPoint } from '../domain/safety';
import {
  IncidentNotFoundError,
  MedicalEventNotFoundError,
} from '../domain/safety.errors';
import {
  IncidentRepository,
  type MedicalEventFilter,
  type MedicalEventRecord,
  MedicalEventRepository,
} from '../domain/safety.repository';

/** Everything the driver sees about one of their incidents. */
export interface IncidentDetail {
  incident: IncidentRecord;
  events: MedicalEventRecord[];
  timeline: TimelineEntry[];
  notifications: NotificationRecord[];
}

/**
 * What a family member sees: that someone needed help, and when. Only
 * incidents that escalated (false alarms stay private), never the kind of
 * emergency or readings. Location only while help is being called.
 */
export interface FamilyIncidentView {
  incidentId: string;
  member: { userId: string; firstName: string; lastName: string };
  status: IncidentStatus;
  openedAt: Date;
  escalatedAt: Date | null;
  resolvedAt: Date | null;
  location: GeoPoint | null;
}

/** Family members see closed incidents for this long. */
const FAMILY_RECENT_DAYS = 7;

@Injectable()
export class SafetyQueryService {
  constructor(
    private readonly events: MedicalEventRepository,
    private readonly incidents: IncidentRepository,
    private readonly directory: SafetyDirectory,
  ) {}

  listEvents(
    userId: string,
    filter: MedicalEventFilter,
  ): Promise<{ items: MedicalEventRecord[]; totalItems: number }> {
    return this.events.listOwn(userId, filter);
  }

  async getEvent(userId: string, eventId: string): Promise<MedicalEventRecord> {
    const event = await this.events.findOwn(userId, eventId);
    if (!event) throw new MedicalEventNotFoundError();
    return event;
  }

  /** The driver's most recent event with the incident it belongs to, if any. */
  async latestEvent(userId: string): Promise<{
    event: MedicalEventRecord;
    incident: IncidentRecord | null;
  } | null> {
    const event = await this.events.latestOwn(userId);
    if (!event) return null;
    const incident = event.incidentId
      ? await this.incidents.findOwn(userId, event.incidentId)
      : null;
    return { event, incident };
  }

  async listIncidents(
    userId: string,
    filter: { page: number; pageSize: number },
  ): Promise<{ items: IncidentRecord[]; totalItems: number }> {
    const page = await this.incidents.listOwn(userId, filter);
    return { ...page, items: page.items.map(withoutStaleLocation) };
  }

  findActive(userId: string): Promise<IncidentRecord | null> {
    return this.incidents.findActive(userId);
  }

  async activeDetail(userId: string): Promise<IncidentDetail | null> {
    const incident = await this.incidents.findActive(userId);
    return incident ? this.detail(incident) : null;
  }

  async incidentDetail(
    userId: string,
    incidentId: string,
  ): Promise<IncidentDetail> {
    const incident = await this.incidents.findOwn(userId, incidentId);
    if (!incident) throw new IncidentNotFoundError();
    return this.detail(incident);
  }

  async familyIncidents(
    viewerId: string,
    now: Date = new Date(),
  ): Promise<FamilyIncidentView[]> {
    const peers = await this.directory.peersSharingIncidents(viewerId);
    if (peers.length === 0) return [];
    const byId = new Map(peers.map((peer) => [peer.userId, peer]));
    const since = new Date(now.getTime() - FAMILY_RECENT_DAYS * 86_400_000);
    const incidents = await this.incidents.listEscalatedForUsers(
      [...byId.keys()],
      since,
    );
    return incidents.flatMap((incident) => {
      const member = byId.get(incident.userId);
      if (!member) return [];
      return [
        {
          incidentId: incident.id,
          member,
          status: incident.status,
          openedAt: incident.openedAt,
          escalatedAt: incident.escalatedAt,
          resolvedAt: incident.resolvedAt,
          location:
            incident.status === IncidentStatus.ESCALATED
              ? incident.location
              : null,
        },
      ];
    });
  }

  private async detail(incident: IncidentRecord): Promise<IncidentDetail> {
    const [events, timeline, notifications] = await Promise.all([
      this.events.listForIncident(incident.id),
      this.incidents.listTimeline(incident.id),
      this.incidents.listNotifications(incident.id),
    ]);
    return {
      incident: withoutStaleLocation(incident),
      events,
      timeline,
      notifications,
    };
  }
}

/** Incident location matters only while the incident is open. */
function withoutStaleLocation(incident: IncidentRecord): IncidentRecord {
  return isActiveIncident(incident.status)
    ? incident
    : { ...incident, location: null };
}
