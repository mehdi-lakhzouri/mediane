import 'fake_backend.dart';

/// Wire-format fixtures for the safety API.

const strokeEventId = '0192a5c4-0000-7000-8000-00000000e001';
const drowsyEventId = '0192a5c4-0000-7000-8000-00000000e002';
const incidentId = '0192a5c4-0000-7000-8000-00000000c001';

String iso(DateTime value) => value.toUtc().toIso8601String();

Map<String, Object?> eventJson({
  String id = strokeEventId,
  String type = 'STROKE',
  String severity = 'CRITICAL',
  String source = 'DEVICE',
  double? confidence = 0.91,
  DateTime? detectedAt,
  String? incident = incidentId,
  Map<String, Object?>? vitals,
  Map<String, Object?>? location,
}) {
  final at = detectedAt ?? DateTime.now().subtract(const Duration(minutes: 5));
  return {
    'id': id,
    'type': type,
    'severity': severity,
    'source': source,
    'confidence': confidence,
    'detectedAt': iso(at),
    'receivedAt': iso(at.add(const Duration(seconds: 1))),
    'incidentId': incident,
    'vitals': ?vitals,
    'location': ?location,
  };
}

Map<String, Object?> incidentJson({
  String id = incidentId,
  String status = 'AWAITING_RESPONSE',
  String severity = 'CRITICAL',
  String triggerType = 'STROKE',
  DateTime? openedAt,
  DateTime? respondBy,
  DateTime? escalatedAt,
  DateTime? resolvedAt,
  String? resolvedVia,
  Map<String, Object?>? location,
}) {
  final opened = openedAt ?? DateTime.now();
  return {
    'id': id,
    'status': status,
    'severity': severity,
    'triggerType': triggerType,
    'openedAt': iso(opened),
    'respondBy': status == 'AWAITING_RESPONSE'
        ? iso(respondBy ?? opened.add(const Duration(seconds: 30)))
        : null,
    'acknowledgedAt': null,
    'acknowledgedVia': null,
    'escalatedAt': escalatedAt == null ? null : iso(escalatedAt),
    'resolvedAt': resolvedAt == null ? null : iso(resolvedAt),
    'resolvedVia': resolvedVia,
    'location': location,
  };
}

Map<String, Object?> notificationJson({
  required String name,
  String kind = 'ALERT',
  String recipientType = 'EMERGENCY_CONTACT',
  int? priority = 1,
  String channel = 'LOG',
  String status = 'SENT',
}) => {
  'kind': kind,
  'recipientType': recipientType,
  'recipientName': name,
  'priority': priority,
  'channel': channel,
  'status': status,
  'attemptedAt': iso(DateTime.now()),
};

Map<String, Object?> incidentDetailJson({
  required Map<String, Object?> incident,
  List<Map<String, Object?>> events = const [],
  List<Map<String, Object?>> timeline = const [],
  List<Map<String, Object?>> notifications = const [],
  DateTime? serverTime,
}) => {
  'serverTime': iso(serverTime ?? DateTime.now()),
  'incident': incident,
  'events': events,
  'timeline': timeline,
  'notifications': notifications,
};

Map<String, Object?> monitoringJson({
  bool paired = true,
  bool online = true,
  Map<String, Object?>? activeIncident,
  Map<String, Object?>? latestEvent,
}) => {
  'device': {
    'paired': paired,
    'online': online,
    'lastSeenAt': paired ? iso(DateTime.now()) : null,
  },
  'activeIncident': activeIncident,
  'latestEvent': latestEvent,
};

/// A paginated list response.
FakeResponse pagedResponse(
  List<Map<String, Object?>> items, {
  int page = 1,
  int totalPages = 1,
}) => FakeResponse(200, {
  'data': items,
  'meta': {
    'requestId': 'test-request',
    'timestamp': iso(DateTime.now()),
    'pagination': {
      'page': page,
      'pageSize': 20,
      'totalItems': items.length,
      'totalPages': totalPages,
    },
  },
  'error': null,
});
