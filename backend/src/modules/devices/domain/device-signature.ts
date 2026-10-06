import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Request signing for in-cabin units (HMAC-SHA256):
 *
 *   canonical = METHOD \n PATH \n TIMESTAMP \n NONCE \n hex(SHA256(body))
 *   signature = hex(HMAC_SHA256(secret, canonical))
 *
 * PATH is the full request path with query string (e.g. /api/v1/device/events).
 * TIMESTAMP is Unix seconds; NONCE is 16–64 URL-safe characters, never reused.
 */
export const DeviceHeaders = {
  SERIAL: 'x-device-serial',
  TIMESTAMP: 'x-device-timestamp',
  NONCE: 'x-device-nonce',
  SIGNATURE: 'x-device-signature',
} as const;

export const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

export interface SignedRequestParts {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: Buffer;
}

export function canonicalRequest(parts: SignedRequestParts): string {
  return [
    parts.method.toUpperCase(),
    parts.path,
    parts.timestamp,
    parts.nonce,
    createHash('sha256').update(parts.body).digest('hex'),
  ].join('\n');
}

export function signRequest(secret: Buffer, parts: SignedRequestParts): string {
  return createHmac('sha256', secret)
    .update(canonicalRequest(parts))
    .digest('hex');
}

/** Constant-time comparison; malformed signatures simply fail. */
export function isValidSignature(
  secret: Buffer,
  parts: SignedRequestParts,
  signature: string,
): boolean {
  if (!SIGNATURE_PATTERN.test(signature)) return false;
  const expected = Buffer.from(signRequest(secret, parts), 'hex');
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

/** Whether a Unix-seconds timestamp is within `windowSeconds` of `now`. */
export function isFreshTimestamp(
  timestamp: string,
  now: Date,
  windowSeconds: number,
): boolean {
  if (!/^\d{9,11}$/.test(timestamp)) return false;
  const skew = Math.abs(now.getTime() / 1000 - Number(timestamp));
  return skew <= windowSeconds;
}
