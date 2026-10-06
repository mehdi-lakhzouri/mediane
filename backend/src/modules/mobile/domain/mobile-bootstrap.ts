export interface MobileFeatureFlags {
  selfRegistration: boolean;
  biometricUnlock: boolean;
  familyJoin: boolean;
}

/** Server-side profile rules, so the app never hard-codes them. */
export interface MobileProfileRules {
  driverMinimumAge: number;
  minEmergencyContacts: number;
  maxEmergencyContacts: number;
  avatarMaxBytes: number;
  avatarMinSidePx: number;
}

export interface MobileBootstrap {
  minimumSupportedVersion: string;
  latestVersion: string;
  maintenance: boolean;
  maintenanceMessage: string;
  maintenanceEndsAt: string | null;
  termsVersion: string;
  privacyVersion: string;
  termsUrl: string;
  privacyUrl: string;
  supportUrl: string;
  features: MobileFeatureFlags;
  profileRules: MobileProfileRules;
}
