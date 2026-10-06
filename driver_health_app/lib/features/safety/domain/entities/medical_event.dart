enum MedicalEventType {
  heartRhythm,
  drowsiness,
  seizure,
  stroke,
  cardiacArrest,

  /// Raised by the driver, not detected.
  sos,
}

/// Decided by the server from the event type.
enum EventSeverity {
  /// In-app warning only; never calls anyone.
  warning,
  urgent,
  critical,
}

enum EventSource { device, driver }

enum HeartRhythm {
  normal,
  atrialFibrillation,
  bradycardia,
  tachycardia,
  ventricularTachycardia,
  ventricularFibrillation,
  asystole,
  irregular,
}

class GeoPoint {
  const new({required this.latitude, required this.longitude, this.accuracyM});

  final double latitude;
  final double longitude;
  final double? accuracyM;
}

/// Readings that came with a detection. Every value is optional.
class Vitals {
  const new({
    this.heartRateBpm,
    this.spo2Percent,
    this.respiratoryRateBpm,
    this.eyeClosurePercent,
    this.rhythm,
  });

  final double? heartRateBpm;
  final double? spo2Percent;
  final double? respiratoryRateBpm;
  final double? eyeClosurePercent;
  final HeartRhythm? rhythm;

  bool get isEmpty =>
      heartRateBpm == null &&
      spo2Percent == null &&
      respiratoryRateBpm == null &&
      eyeClosurePercent == null &&
      rhythm == null;
}

/// A detection from the in-cabin unit or an SOS press. List screens get
/// summaries; [vitals] and [location] come with the detail only.
class MedicalEvent {
  const new({
    required this.id,
    required this.type,
    required this.severity,
    required this.source,
    required this.detectedAt,
    required this.receivedAt,
    this.confidence,
    this.incidentId,
    this.vitals,
    this.location,
  });

  final String id;
  final MedicalEventType type;
  final EventSeverity severity;
  final EventSource source;

  /// Detector confidence, 0..1. Null for SOS.
  final double? confidence;

  /// Unit clock.
  final DateTime detectedAt;

  /// Server clock.
  final DateTime receivedAt;
  final String? incidentId;
  final Vitals? vitals;
  final GeoPoint? location;
}
