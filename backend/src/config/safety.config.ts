import { hkdfSync } from 'node:crypto';
import { ConfigType, registerAs } from '@nestjs/config';
import { NodeEnv, readEnv } from './env.validation';

/** Separate key for device secrets, derived when none is configured. */
function deviceKey(env: ReturnType<typeof readEnv>): Buffer {
  if (env.DEVICE_ENCRYPTION_KEY) {
    return Buffer.from(env.DEVICE_ENCRYPTION_KEY, 'base64');
  }
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(env.MFA_ENCRYPTION_KEY, 'base64'),
      Buffer.alloc(0),
      'cabinguard/device-secrets/v1',
      32,
    ),
  );
}

export const safetyConfig = registerAs('safety', () => {
  const env = readEnv();
  return {
    deviceEncryptionKey: deviceKey(env),
    signatureWindowSeconds: env.DEVICE_SIGNATURE_WINDOW_SECONDS,
    criticalResponseSeconds: env.SAFETY_CRITICAL_RESPONSE_SECONDS,
    urgentResponseSeconds: env.SAFETY_URGENT_RESPONSE_SECONDS,
    // Tests drive escalation explicitly instead of on a timer.
    workerEnabled: env.SAFETY_WORKER_ENABLED && env.NODE_ENV !== NodeEnv.Test,
    workerIntervalMs: env.SAFETY_WORKER_INTERVAL_MS,
    autoCloseHours: env.SAFETY_AUTO_CLOSE_HOURS,
    eventRetentionDays: env.SAFETY_EVENT_RETENTION_DAYS,
    incidentRetentionDays: env.SAFETY_INCIDENT_RETENTION_DAYS,
  };
});

export type SafetyConfig = ConfigType<typeof safetyConfig>;
