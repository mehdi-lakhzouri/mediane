/**
 * Per-account brute-force protection (complements the per-IP rate limit).
 * After MAX_FAILED_ATTEMPTS consecutive failures the account is locked for
 * LOCK_DURATION; during the lock the response stays INVALID_CREDENTIALS so the
 * lock itself does not reveal that the account exists.
 */
export const LoginPolicy = {
  MAX_FAILED_ATTEMPTS: 5,
  LOCK_DURATION_MS: 15 * 60 * 1000,
} as const;

/** Anti mail-bombing: max reset emails per account per window (silently ignored above). */
export const PasswordResetPolicy = {
  MAX_REQUESTS_PER_WINDOW: 3,
  WINDOW_MS: 60 * 60 * 1000,
} as const;
