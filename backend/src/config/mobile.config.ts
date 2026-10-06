import { ConfigType, registerAs } from '@nestjs/config';
import { readEnv } from './env.validation';

function productUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl.replace(/\/+$/, '')}/`).toString();
}

export const mobileConfig = registerAs('mobile', () => {
  const env = readEnv();

  return {
    minimumSupportedVersion: env.MOBILE_MINIMUM_SUPPORTED_VERSION,
    latestVersion: env.MOBILE_LATEST_VERSION,
    maintenance: env.MOBILE_MAINTENANCE,
    maintenanceMessage:
      env.MOBILE_MAINTENANCE_MESSAGE ??
      'CabinGuard is receiving a safety update. Please try again shortly.',
    maintenanceEndsAt: env.MOBILE_MAINTENANCE_ENDS_AT ?? null,
    termsVersion: env.MOBILE_TERMS_VERSION,
    privacyVersion: env.MOBILE_PRIVACY_VERSION,
    termsUrl: env.MOBILE_TERMS_URL ?? productUrl(env.FRONTEND_URL, 'terms'),
    privacyUrl:
      env.MOBILE_PRIVACY_URL ?? productUrl(env.FRONTEND_URL, 'privacy'),
    supportUrl:
      env.MOBILE_SUPPORT_URL ?? productUrl(env.FRONTEND_URL, 'support'),
    features: {
      selfRegistration: env.MOBILE_SELF_REGISTRATION,
      biometricUnlock: env.MOBILE_BIOMETRIC_UNLOCK,
      familyJoin: env.MOBILE_FAMILY_JOIN,
    },
  };
});

export type MobileConfig = ConfigType<typeof mobileConfig>;
