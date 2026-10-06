class MobileFeatureFlags {
  const new({
    required this.selfRegistration,
    required this.biometricUnlock,
    required this.familyJoin,
  });

  final bool selfRegistration;
  final bool biometricUnlock;
  final bool familyJoin;
}

/// Profile rules published by the server; never hard-coded in the app.
class ProfileRules {
  const new({
    required this.driverMinimumAge,
    required this.minEmergencyContacts,
    required this.maxEmergencyContacts,
    required this.avatarMaxBytes,
    required this.avatarMinSidePx,
  });

  final int driverMinimumAge;
  final int minEmergencyContacts;
  final int maxEmergencyContacts;
  final int avatarMaxBytes;
  final int avatarMinSidePx;
}

class MobileBootstrap {
  const new({
    required this.minimumSupportedVersion,
    required this.latestVersion,
    required this.maintenance,
    required this.maintenanceMessage,
    required this.maintenanceEndsAt,
    required this.termsVersion,
    required this.privacyVersion,
    required this.termsUrl,
    required this.privacyUrl,
    required this.supportUrl,
    required this.features,
    required this.profileRules,
  });

  final String minimumSupportedVersion;
  final String latestVersion;
  final bool maintenance;
  final String maintenanceMessage;
  final DateTime? maintenanceEndsAt;
  final String termsVersion;
  final String privacyVersion;
  final Uri termsUrl;
  final Uri privacyUrl;
  final Uri supportUrl;
  final MobileFeatureFlags features;
  final ProfileRules profileRules;
}
