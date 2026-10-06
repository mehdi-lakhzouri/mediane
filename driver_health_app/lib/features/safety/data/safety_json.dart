import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';

/// Maps safety API payloads to domain entities. Unknown enum values from a
/// newer server degrade gracefully instead of failing the whole screen.
abstract final class SafetyJson {
  static MedicalEvent event(Map<String, Object?> json) => MedicalEvent(
    id: _string(json, 'id'),
    type: eventType(json['type']),
    severity: severity(json['severity']),
    source: json['source'] == 'DRIVER'
        ? EventSource.driver
        : EventSource.device,
    confidence: _double(json['confidence']),
    detectedAt: _date(json, 'detectedAt'),
    receivedAt: _date(json, 'receivedAt'),
    incidentId: json['incidentId'] as String?,
    vitals: _vitals(json['vitals']),
    location: geoPoint(json['location']),
  );

  static Incident incident(Map<String, Object?> json) => Incident(
    id: _string(json, 'id'),
    status: incidentStatus(json['status']),
    severity: severity(json['severity']),
    triggerType: eventType(json['triggerType']),
    openedAt: _date(json, 'openedAt'),
    respondBy: _optionalDate(json['respondBy']),
    acknowledgedAt: _optionalDate(json['acknowledgedAt']),
    acknowledgedVia: _channel(json['acknowledgedVia']),
    escalatedAt: _optionalDate(json['escalatedAt']),
    resolvedAt: _optionalDate(json['resolvedAt']),
    resolvedVia: _channel(json['resolvedVia']),
    location: geoPoint(json['location']),
  );

  static IncidentDetail incidentDetail(
    Map<String, Object?> json, {
    DateTime? fetchedAt,
  }) {
    final arrived = fetchedAt ?? DateTime.now();
    return IncidentDetail(
      incident: incident(_map(json, 'incident')),
      serverTime: _optionalDate(json['serverTime']) ?? arrived,
      fetchedAt: arrived,
      events: [for (final e in _list(json['events'])) event(e)],
      timeline: [
        for (final entry in _list(json['timeline']))
          if (_timelineKind(entry['kind']) case final kind?)
            TimelineEntry(
              kind: kind,
              at: _date(entry, 'at'),
              detail: entry['detail'] is Map
                  ? Map<String, Object?>.from(entry['detail']! as Map)
                  : const {},
            ),
      ],
      notifications: [
        for (final n in _list(json['notifications'])) _notification(n),
      ],
    );
  }

  static FamilyIncident familyIncident(Map<String, Object?> json) {
    final member = _map(json, 'member');
    return FamilyIncident(
      incidentId: _string(json, 'incidentId'),
      memberUserId: _string(member, 'userId'),
      memberFirstName: member['firstName'] as String? ?? '',
      memberLastName: member['lastName'] as String? ?? '',
      status: incidentStatus(json['status']),
      openedAt: _date(json, 'openedAt'),
      escalatedAt: _optionalDate(json['escalatedAt']),
      resolvedAt: _optionalDate(json['resolvedAt']),
      location: geoPoint(json['location']),
    );
  }

  static MedicalEventType eventType(Object? value) => switch (value) {
    'HEART_RHYTHM' => MedicalEventType.heartRhythm,
    'DROWSINESS' => MedicalEventType.drowsiness,
    'SEIZURE' => MedicalEventType.seizure,
    'STROKE' => MedicalEventType.stroke,
    'CARDIAC_ARREST' => MedicalEventType.cardiacArrest,
    'SOS' => MedicalEventType.sos,
    // A type this version does not know: treat it with the most care.
    _ => MedicalEventType.sos,
  };

  static String eventTypeToJson(MedicalEventType type) => switch (type) {
    MedicalEventType.heartRhythm => 'HEART_RHYTHM',
    MedicalEventType.drowsiness => 'DROWSINESS',
    MedicalEventType.seizure => 'SEIZURE',
    MedicalEventType.stroke => 'STROKE',
    MedicalEventType.cardiacArrest => 'CARDIAC_ARREST',
    MedicalEventType.sos => 'SOS',
  };

  static EventSeverity severity(Object? value) => switch (value) {
    'WARNING' => EventSeverity.warning,
    'URGENT' => EventSeverity.urgent,
    _ => EventSeverity.critical,
  };

  static IncidentStatus incidentStatus(Object? value) => switch (value) {
    'AWAITING_RESPONSE' => IncidentStatus.awaitingResponse,
    'ESCALATED' => IncidentStatus.escalated,
    'FALSE_ALARM' => IncidentStatus.falseAlarm,
    _ => IncidentStatus.resolved,
  };

  static IncidentStatus? optionalIncidentStatus(Object? value) =>
      value is String ? incidentStatus(value) : null;

  static GeoPoint? geoPoint(Object? value) {
    if (value is! Map) return null;
    final latitude = _double(value['latitude']);
    final longitude = _double(value['longitude']);
    if (latitude == null || longitude == null) return null;
    return GeoPoint(
      latitude: latitude,
      longitude: longitude,
      accuracyM: _double(value['accuracyM']),
    );
  }

  static Vitals? _vitals(Object? value) {
    if (value is! Map) return null;
    final vitals = Vitals(
      heartRateBpm: _double(value['heartRateBpm']),
      spo2Percent: _double(value['spo2Percent']),
      respiratoryRateBpm: _double(value['respiratoryRateBpm']),
      eyeClosurePercent: _double(value['eyeClosurePercent']),
      rhythm: switch (value['rhythm']) {
        'NORMAL' => HeartRhythm.normal,
        'ATRIAL_FIBRILLATION' => HeartRhythm.atrialFibrillation,
        'BRADYCARDIA' => HeartRhythm.bradycardia,
        'TACHYCARDIA' => HeartRhythm.tachycardia,
        'VENTRICULAR_TACHYCARDIA' => HeartRhythm.ventricularTachycardia,
        'VENTRICULAR_FIBRILLATION' => HeartRhythm.ventricularFibrillation,
        'ASYSTOLE' => HeartRhythm.asystole,
        'IRREGULAR' => HeartRhythm.irregular,
        _ => null,
      },
    );
    return vitals.isEmpty ? null : vitals;
  }

  static NotificationAttempt _notification(Map<String, Object?> json) =>
      NotificationAttempt(
        kind: json['kind'] == 'ALL_CLEAR'
            ? NotificationKind.allClear
            : NotificationKind.alert,
        recipientType: json['recipientType'] == 'FAMILY_MEMBER'
            ? RecipientType.familyMember
            : RecipientType.emergencyContact,
        recipientName: json['recipientName'] as String? ?? '',
        priority: json['priority'] as int?,
        channel: switch (json['channel']) {
          'EMAIL' => NotificationChannel.email,
          'SMS' => NotificationChannel.sms,
          'VOICE' => NotificationChannel.voice,
          'PUSH' => NotificationChannel.push,
          _ => NotificationChannel.log,
        },
        status: switch (json['status']) {
          'SENT' => NotificationStatus.sent,
          'SKIPPED' => NotificationStatus.skipped,
          _ => NotificationStatus.failed,
        },
        attemptedAt: _date(json, 'attemptedAt'),
      );

  static TimelineKind? _timelineKind(Object? value) => switch (value) {
    'OPENED' => TimelineKind.opened,
    'EVENT_ADDED' => TimelineKind.eventAdded,
    'ACKNOWLEDGED' => TimelineKind.acknowledged,
    'ESCALATED' => TimelineKind.escalated,
    'NOTIFIED' => TimelineKind.notified,
    'RESOLVED' => TimelineKind.resolved,
    _ => null,
  };

  static IncidentChannel? _channel(Object? value) => switch (value) {
    'APP' => IncidentChannel.app,
    'DEVICE' => IncidentChannel.device,
    'SYSTEM' => IncidentChannel.system,
    _ => null,
  };

  static List<Map<String, Object?>> _list(Object? value) => [
    if (value is List)
      for (final item in value)
        if (item is Map) Map<String, Object?>.from(item),
  ];

  static Map<String, Object?> _map(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is Map) return Map<String, Object?>.from(value);
    throw FormatException('Missing safety field: $key');
  }

  static String _string(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is String && value.isNotEmpty) return value;
    throw FormatException('Missing safety field: $key');
  }

  static double? _double(Object? value) =>
      value is num ? value.toDouble() : null;

  static DateTime _date(Map<String, Object?> json, String key) {
    final value = _optionalDate(json[key]);
    if (value == null) throw FormatException('Invalid safety date: $key');
    return value;
  }

  static DateTime? _optionalDate(Object? value) =>
      value is String ? DateTime.tryParse(value) : null;
}
