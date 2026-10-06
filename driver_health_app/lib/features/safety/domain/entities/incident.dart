import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';

/// AWAITING_RESPONSE → (I'm OK) FALSE_ALARM, or → (timeout / SOS) ESCALATED
/// → (I'm OK / auto-close) RESOLVED.
enum IncidentStatus { awaitingResponse, escalated, resolved, falseAlarm }

enum IncidentChannel { app, device, system }

enum TimelineKind {
  opened,
  eventAdded,
  acknowledged,
  escalated,
  notified,
  resolved,
}

enum NotificationKind { alert, allClear }

enum RecipientType { emergencyContact, familyMember }

enum NotificationChannel { log, email, sms, voice, push }

enum NotificationStatus { sent, failed, skipped }

class Incident {
  const new({
    required this.id,
    required this.status,
    required this.severity,
    required this.triggerType,
    required this.openedAt,
    this.respondBy,
    this.acknowledgedAt,
    this.acknowledgedVia,
    this.escalatedAt,
    this.resolvedAt,
    this.resolvedVia,
    this.location,
  });

  final String id;
  final IncidentStatus status;
  final EventSeverity severity;
  final MedicalEventType triggerType;
  final DateTime openedAt;

  /// Help is called when this passes without an answer.
  final DateTime? respondBy;
  final DateTime? acknowledgedAt;
  final IncidentChannel? acknowledgedVia;
  final DateTime? escalatedAt;
  final DateTime? resolvedAt;
  final IncidentChannel? resolvedVia;

  /// Only while the incident is open.
  final GeoPoint? location;

  bool get isActive =>
      status == IncidentStatus.awaitingResponse ||
      status == IncidentStatus.escalated;

  /// Whether emergency contacts or family were called.
  bool get contactsAlerted => escalatedAt != null;
}

class TimelineEntry {
  const new({required this.kind, required this.at, this.detail = const {}});

  final TimelineKind kind;
  final DateTime at;

  /// Non-medical context (channel, recipient counts).
  final Map<String, Object?> detail;
}

/// One attempt to reach someone, as shown to the driver.
class NotificationAttempt {
  const new({
    required this.kind,
    required this.recipientType,
    required this.recipientName,
    required this.channel,
    required this.status,
    required this.attemptedAt,
    this.priority,
  });

  final NotificationKind kind;
  final RecipientType recipientType;
  final String recipientName;
  final int? priority;
  final NotificationChannel channel;
  final NotificationStatus status;
  final DateTime attemptedAt;
}

/// Everything the driver sees about one incident.
class IncidentDetail {
  const new({
    required this.incident,
    required this.serverTime,
    required this.fetchedAt,
    this.events = const [],
    this.timeline = const [],
    this.notifications = const [],
  });

  final Incident incident;
  final List<MedicalEvent> events;
  final List<TimelineEntry> timeline;
  final List<NotificationAttempt> notifications;

  /// Server clock when the detail was produced, and local clock when it
  /// arrived: the countdown is computed on server time.
  final DateTime serverTime;
  final DateTime fetchedAt;

  /// Server time now, estimated from the local clock.
  DateTime serverNow(DateTime localNow) =>
      serverTime.add(localNow.difference(fetchedAt));

  /// Time left to answer, or `null` when nothing is counting down.
  Duration? remaining(DateTime localNow) {
    final respondBy = incident.respondBy;
    if (respondBy == null ||
        incident.status != IncidentStatus.awaitingResponse) {
      return null;
    }
    final left = respondBy.difference(serverNow(localNow));
    return left.isNegative ? Duration.zero : left;
  }

  /// People the alert went to, in call order.
  List<NotificationAttempt> get alerts => [
    for (final n in notifications)
      if (n.kind == NotificationKind.alert) n,
  ];
}

/// A family member's incident as the family sees it: who and when, never
/// what happened.
class FamilyIncident {
  const new({
    required this.incidentId,
    required this.memberUserId,
    required this.memberFirstName,
    required this.memberLastName,
    required this.status,
    required this.openedAt,
    this.escalatedAt,
    this.resolvedAt,
    this.location,
  });

  final String incidentId;
  final String memberUserId;
  final String memberFirstName;
  final String memberLastName;
  final IncidentStatus status;
  final DateTime openedAt;
  final DateTime? escalatedAt;
  final DateTime? resolvedAt;

  /// Only while help is being called.
  final GeoPoint? location;

  bool get needsHelp => status == IncidentStatus.escalated;
}
