import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';

enum FamilyStatus { none, requestPending, member, owner }

enum SafetyRecommendation { enableTwoStep, regenerateRecoveryCodes, joinFamily }

/// Capabilities the backend provides today; the rest of the home screen is
/// hidden until they exist.
class DashboardFeatures {
  const new({
    required this.medicalEvents,
    required this.emergencyAlerts,
    required this.notifications,
    required this.vehicleTelemetry,
  });

  final bool medicalEvents;
  final bool emergencyAlerts;
  final bool notifications;
  final bool vehicleTelemetry;
}

/// The open incident, as much as the home screen needs.
class ActiveIncidentSummary {
  const new({
    required this.id,
    required this.status,
    required this.triggerType,
    this.respondBy,
  });

  final String id;
  final IncidentStatus status;
  final MedicalEventType triggerType;
  final DateTime? respondBy;
}

class LatestEventSummary {
  const new({
    required this.id,
    required this.type,
    required this.severity,
    required this.detectedAt,
    required this.contactsAlerted,
    this.incidentStatus,
  });

  final String id;
  final MedicalEventType type;
  final EventSeverity severity;
  final DateTime detectedAt;

  /// Outcome of the incident it belongs to; `null` for warnings.
  final IncidentStatus? incidentStatus;
  final bool contactsAlerted;
}

/// Live safety state: the in-cabin unit, an open incident, the last event.
class DashboardMonitoring {
  const new({
    this.devicePaired = false,
    this.deviceOnline = false,
    this.deviceLastSeenAt,
    this.activeIncident,
    this.latestEvent,
  });

  final bool devicePaired;
  final bool deviceOnline;
  final DateTime? deviceLastSeenAt;
  final ActiveIncidentSummary? activeIncident;
  final LatestEventSummary? latestEvent;
}

class DashboardFamily {
  const new({
    required this.status,
    required this.name,
    required this.memberCount,
    required this.maxMembers,
    required this.pendingJoinRequests,
    required this.pendingRequestFamily,
  });

  final FamilyStatus status;
  final String? name;
  final int? memberCount;
  final int? maxMembers;

  /// Owners only.
  final int pendingJoinRequests;

  /// The family the driver asked to join, while waiting.
  final String? pendingRequestFamily;
}

class Dashboard {
  const new({
    required this.serverTime,
    required this.firstName,
    required this.lastName,
    required this.avatar,
    required this.safetyReady,
    required this.emergencyContactCount,
    required this.recommendations,
    required this.family,
    required this.mfaEnabled,
    required this.features,
    this.monitoring = const DashboardMonitoring(),
    this.unreadNotifications = 0,
  });

  final DateTime serverTime;
  final String firstName;
  final String lastName;
  final ProfileAvatar? avatar;
  final bool safetyReady;
  final int emergencyContactCount;
  final List<SafetyRecommendation> recommendations;
  final DashboardFamily family;
  final bool mfaEnabled;
  final DashboardFeatures features;
  final DashboardMonitoring monitoring;

  /// Badge on the bell.
  final int unreadNotifications;

  String get fullName => '$firstName $lastName'.trim();

  String get initials {
    final first = firstName.isEmpty ? '' : firstName.substring(0, 1);
    final last = lastName.isEmpty ? '' : lastName.substring(0, 1);
    final value = (first + last).toUpperCase();
    return value.isEmpty ? '?' : value;
  }
}
