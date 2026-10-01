/**
 * Keys whose values must never reach logs or audit metadata.
 * Shared by the Pino redaction config and the audit metadata sanitizer.
 */
export const SENSITIVE_KEYS = [
  'password',
  'currentPassword',
  'newPassword',
  'passwordConfirmation',
  'temporaryPassword',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'tokenHash',
  'csrfToken',
  'secret',
  'authorization',
  'cookie',
] as const;

const NORMALIZED_SENSITIVE_KEYS = new Set<string>(
  SENSITIVE_KEYS.map((key) => key.toLowerCase()),
);

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    NORMALIZED_SENSITIVE_KEYS.has(normalized) ||
    normalized.includes('password') ||
    normalized.includes('token') ||
    normalized.includes('secret')
  );
}
