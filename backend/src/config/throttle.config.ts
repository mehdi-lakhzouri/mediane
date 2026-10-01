import { ConfigType, registerAs } from '@nestjs/config';
import { seconds } from '@nestjs/throttler';
import { readEnv } from './env.validation';

/**
 * Global fallback limit only. Stricter per-endpoint policies are security rules
 * reviewed in code: see modules/security/presentation/rate-limit.policies.ts.
 */
export const throttleConfig = registerAs('throttle', () => {
  const env = readEnv();
  return {
    defaultTtlMs: seconds(env.THROTTLE_DEFAULT_TTL_SECONDS),
    defaultLimit: env.THROTTLE_DEFAULT_LIMIT,
  };
});

export type ThrottleConfig = ConfigType<typeof throttleConfig>;
