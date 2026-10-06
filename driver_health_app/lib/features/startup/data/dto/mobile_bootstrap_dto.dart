import 'package:driver_health_app/features/startup/domain/entities/mobile_bootstrap.dart';

class MobileBootstrapDto {
  const new(this._json);

  factory fromJson(Map<String, Object?> json) {
    return MobileBootstrapDto(json);
  }

  final Map<String, Object?> _json;

  MobileBootstrap toDomain() {
    final features = _map(_json, 'features');
    final rules = _map(_json, 'profileRules');
    final maintenanceEndsAt = _json['maintenanceEndsAt'];

    return MobileBootstrap(
      minimumSupportedVersion: _string(_json, 'minimumSupportedVersion'),
      latestVersion: _string(_json, 'latestVersion'),
      maintenance: _bool(_json, 'maintenance'),
      maintenanceMessage: _string(_json, 'maintenanceMessage'),
      maintenanceEndsAt: maintenanceEndsAt is String
          ? DateTime.tryParse(maintenanceEndsAt)
          : null,
      termsVersion: _string(_json, 'termsVersion'),
      privacyVersion: _string(_json, 'privacyVersion'),
      termsUrl: Uri.parse(_string(_json, 'termsUrl')),
      privacyUrl: Uri.parse(_string(_json, 'privacyUrl')),
      supportUrl: Uri.parse(_string(_json, 'supportUrl')),
      features: MobileFeatureFlags(
        selfRegistration: _bool(features, 'selfRegistration'),
        biometricUnlock: _bool(features, 'biometricUnlock'),
        familyJoin: _bool(features, 'familyJoin'),
      ),
      profileRules: ProfileRules(
        driverMinimumAge: _int(rules, 'driverMinimumAge'),
        minEmergencyContacts: _int(rules, 'minEmergencyContacts'),
        maxEmergencyContacts: _int(rules, 'maxEmergencyContacts'),
        avatarMaxBytes: _int(rules, 'avatarMaxBytes'),
        avatarMinSidePx: _int(rules, 'avatarMinSidePx'),
      ),
    );
  }

  static String _string(Map<String, Object?> map, String key) {
    final value = map[key];
    if (value is String && value.isNotEmpty) return value;
    throw FormatException('Missing string field: $key');
  }

  static bool _bool(Map<String, Object?> map, String key) {
    final value = map[key];
    if (value is bool) return value;
    throw FormatException('Missing boolean field: $key');
  }

  static int _int(Map<String, Object?> map, String key) {
    final value = map[key];
    if (value is int) return value;
    throw FormatException('Missing integer field: $key');
  }

  static Map<String, Object?> _map(Map<String, Object?> map, String key) {
    final value = map[key];
    if (value is Map) return Map<String, Object?>.from(value);
    throw FormatException('Missing object field: $key');
  }
}
