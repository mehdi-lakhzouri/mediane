import { seconds, Throttle } from '@nestjs/throttler';

export interface RateLimitPolicy {
  limit: number;
  ttlSeconds: number;
  /** Once exceeded, the client stays blocked for this long. */
  blockSeconds?: number;
}

/**
 * Per-endpoint limits, per client IP and per route (the throttler key includes
 * controller + handler). These are security rules: they live in code, not in env.
 * Storage is in-memory for now; for several instances, plug a Redis storage into
 * ThrottlerModule (see app.module.ts) without touching these policies.
 * TODO: add per-account throttling/lockout inside the login use case
 * (failedLoginAttempts / lockedUntil columns already exist).
 */
export const RateLimitPolicies = {
  LOGIN: { limit: 5, ttlSeconds: 60, blockSeconds: 300 },
  REFRESH: { limit: 30, ttlSeconds: 60 },
  FORGOT_PASSWORD: { limit: 3, ttlSeconds: 900, blockSeconds: 900 },
  RESET_PASSWORD: { limit: 5, ttlSeconds: 900 },
  CHANGE_PASSWORD: { limit: 5, ttlSeconds: 900 },
  INVITATION_ACCEPT: { limit: 10, ttlSeconds: 900, blockSeconds: 900 },
  INVITATION_RESEND: { limit: 5, ttlSeconds: 3600 },
  CSRF_TOKEN: { limit: 30, ttlSeconds: 60 },
  PROFILE_UPDATE: { limit: 20, ttlSeconds: 900 },
  AVATAR_UPLOAD: { limit: 10, ttlSeconds: 3600 },
  MFA_CHALLENGE: { limit: 10, ttlSeconds: 300, blockSeconds: 300 },
  MFA_MANAGE: { limit: 10, ttlSeconds: 900 },
  /** Bounds join-code guessing (a valid code still needs the owner's approval). */
  FAMILY_JOIN: { limit: 10, ttlSeconds: 3600, blockSeconds: 3600 },
} as const satisfies Record<string, RateLimitPolicy>;

export const RateLimit = (
  policy: RateLimitPolicy,
): MethodDecorator & ClassDecorator =>
  Throttle({
    default: {
      limit: policy.limit,
      ttl: seconds(policy.ttlSeconds),
      ...(policy.blockSeconds
        ? { blockDuration: seconds(policy.blockSeconds) }
        : {}),
    },
  });
