/**
 * Minimal JWT claims: identity + session binding. Nothing else (no email, no
 * profile/medical data): JWT payloads are only base64-encoded, not encrypted.
 */
export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

export function isAccessTokenPayload(
  value: unknown,
): value is AccessTokenPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.sub === 'string' && typeof candidate.sid === 'string';
}
