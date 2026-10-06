import type { IncidentDetail } from '../application/safety-query.service';
import type { IncidentRecord } from '../domain/incident';
import type { NotificationRecord } from '../domain/notification';
import type { MedicalEventRecord } from '../domain/safety.repository';
import type {
  IncidentDetailResponse,
  IncidentResponse,
  MedicalEventResponse,
  MedicalEventSummaryResponse,
  NotificationResponse,
} from './dto/safety-response.dto';

/** Explicit mapping: internal fields (user and device ids, idempotency keys) never leak. */
export function presentEventSummary(
  event: MedicalEventRecord,
): MedicalEventSummaryResponse {
  return {
    id: event.id,
    type: event.type,
    severity: event.severity,
    source: event.source,
    confidence: event.confidence,
    detectedAt: event.detectedAt,
    receivedAt: event.receivedAt,
    incidentId: event.incidentId,
  };
}

export function presentEvent(event: MedicalEventRecord): MedicalEventResponse {
  return {
    ...presentEventSummary(event),
    vitals: event.vitals,
    location: event.location,
  };
}

export function presentIncident(incident: IncidentRecord): IncidentResponse {
  return {
    id: incident.id,
    status: incident.status,
    severity: incident.severity,
    triggerType: incident.triggerType,
    openedAt: incident.openedAt,
    respondBy: incident.respondBy,
    acknowledgedAt: incident.acknowledgedAt,
    acknowledgedVia: incident.acknowledgedVia,
    escalatedAt: incident.escalatedAt,
    resolvedAt: incident.resolvedAt,
    resolvedVia: incident.resolvedVia,
    location: incident.location,
  };
}

function presentNotification(
  notification: NotificationRecord,
): NotificationResponse {
  return {
    kind: notification.kind,
    recipientType: notification.recipientType,
    recipientName: notification.recipientName,
    priority: notification.priority,
    channel: notification.channel,
    status: notification.status,
    attemptedAt: notification.attemptedAt,
  };
}

export function presentIncidentDetail(
  detail: IncidentDetail,
  serverTime: Date = new Date(),
): IncidentDetailResponse {
  return {
    serverTime,
    incident: presentIncident(detail.incident),
    events: detail.events.map(presentEventSummary),
    timeline: detail.timeline.map((entry) => ({
      kind: entry.kind,
      at: entry.at,
      detail: entry.detail,
    })),
    notifications: detail.notifications.map(presentNotification),
  };
}
