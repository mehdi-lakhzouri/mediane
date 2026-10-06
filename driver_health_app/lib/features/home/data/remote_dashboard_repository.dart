import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';
import 'package:driver_health_app/features/home/domain/entities/dashboard.dart';
import 'package:driver_health_app/features/safety/data/safety_json.dart';

class RemoteDashboardRepository {
  const new(this._dio);

  final Dio _dio;

  Future<Dashboard> fetch() async {
    final response = await _dio.get<Object?>('mobile/dashboard');
    return _dashboard(ApiEnvelope.data(response.data));
  }

  static Dashboard _dashboard(Map<String, Object?> json) {
    final driver = _map(json, 'driver');
    final safety = _map(json, 'safety');
    final family = _map(json, 'family');
    final security = _map(json, 'security');
    final features = _map(json, 'features');
    final avatar = driver['avatar'];
    final pendingRequest = family['pendingRequest'];

    return Dashboard(
      serverTime:
          DateTime.tryParse(json['serverTime'] as String? ?? '') ??
          DateTime.now(),
      firstName: driver['firstName'] as String? ?? '',
      lastName: driver['lastName'] as String? ?? '',
      avatar: ProfileAvatar.tryParse(avatar),
      safetyReady: safety['ready'] == true,
      emergencyContactCount: safety['emergencyContactCount'] as int? ?? 0,
      recommendations: [
        for (final value in (safety['recommendations'] as List?) ?? const [])
          ?switch (value) {
            'ENABLE_TWO_STEP' => SafetyRecommendation.enableTwoStep,
            'REGENERATE_RECOVERY_CODES' =>
              SafetyRecommendation.regenerateRecoveryCodes,
            'JOIN_OR_CREATE_FAMILY' => SafetyRecommendation.joinFamily,
            _ => null,
          },
      ],
      family: DashboardFamily(
        status: switch (family['state']) {
          'OWNER' => FamilyStatus.owner,
          'MEMBER' => FamilyStatus.member,
          'REQUEST_PENDING' => FamilyStatus.requestPending,
          _ => FamilyStatus.none,
        },
        name: family['name'] as String?,
        memberCount: family['memberCount'] as int?,
        maxMembers: family['maxMembers'] as int?,
        pendingJoinRequests: family['pendingJoinRequests'] as int? ?? 0,
        pendingRequestFamily: pendingRequest is Map
            ? pendingRequest['familyName'] as String?
            : null,
      ),
      mfaEnabled: security['mfaEnabled'] == true,
      monitoring: _monitoring(json['monitoring']),
      unreadNotifications: switch (json['notifications']) {
        {'unread': final int unread} => unread,
        _ => 0,
      },
      features: DashboardFeatures(
        medicalEvents: features['medicalEvents'] == true,
        emergencyAlerts: features['emergencyAlerts'] == true,
        notifications: features['notifications'] == true,
        vehicleTelemetry: features['vehicleTelemetry'] == true,
      ),
    );
  }

  /// Older servers have no monitoring section: everything reads as absent.
  static DashboardMonitoring _monitoring(Object? value) {
    if (value is! Map) return const DashboardMonitoring();
    final device = value['device'];
    final incident = value['activeIncident'];
    final event = value['latestEvent'];
    return DashboardMonitoring(
      devicePaired: device is Map && device['paired'] == true,
      deviceOnline: device is Map && device['online'] == true,
      deviceLastSeenAt: device is Map
          ? DateTime.tryParse(device['lastSeenAt'] as String? ?? '')
          : null,
      activeIncident: incident is Map && incident['id'] is String
          ? ActiveIncidentSummary(
              id: incident['id']! as String,
              status: SafetyJson.incidentStatus(incident['status']),
              triggerType: SafetyJson.eventType(incident['triggerType']),
              respondBy: DateTime.tryParse(
                incident['respondBy'] as String? ?? '',
              ),
            )
          : null,
      latestEvent: event is Map && event['id'] is String
          ? LatestEventSummary(
              id: event['id']! as String,
              type: SafetyJson.eventType(event['type']),
              severity: SafetyJson.severity(event['severity']),
              detectedAt:
                  DateTime.tryParse(event['detectedAt'] as String? ?? '') ??
                  DateTime.now(),
              incidentStatus: SafetyJson.optionalIncidentStatus(
                event['incidentStatus'],
              ),
              contactsAlerted: event['contactsAlerted'] == true,
            )
          : null,
    );
  }

  static Map<String, Object?> _map(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is Map) return Map<String, Object?>.from(value);
    throw FormatException('Missing dashboard section: $key');
  }
}
