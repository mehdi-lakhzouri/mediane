import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238) with the parameters every authenticator app supports:
 * HMAC-SHA1, 6 digits, 30-second steps. Changing them would break existing
 * enrolments, so they are constants, not configuration.
 */
export const TOTP_PARAMETERS = {
  algorithm: 'SHA1',
  digits: 6,
  periodSeconds: 30,
} as const;

/** RFC 4226 recommends at least 128 bits; 160 bits matches SHA-1's block. */
const SECRET_BYTES = 20;
/** Accept the previous and next step: clock drift and typing time. */
const DRIFT_STEPS = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): Buffer {
  return randomBytes(SECRET_BYTES);
}

/** RFC 4648 base32 without padding, the format authenticator apps expect. */
export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function timeStep(at: Date): number {
  return Math.floor(at.getTime() / 1000 / TOTP_PARAMETERS.periodSeconds);
}

/** RFC 4226 HOTP value for one counter, as a zero-padded string. */
export function hotp(
  secret: Buffer,
  counter: number,
  digits: number = TOTP_PARAMETERS.digits,
): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac('sha1', secret).update(message).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function totpAt(secret: Buffer, at: Date): string {
  return hotp(secret, timeStep(at));
}

/**
 * Returns the time step the code belongs to (within the drift window), or
 * null. Callers must reject a step that was already used (replay).
 */
export function matchTotpStep(
  secret: Buffer,
  code: string,
  at: Date,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = timeStep(at);
  const presented = Buffer.from(code);
  let matched: number | null = null;
  // Every candidate is computed and compared: timing does not reveal which matched.
  for (let delta = -DRIFT_STEPS; delta <= DRIFT_STEPS; delta++) {
    const expected = Buffer.from(hotp(secret, current + delta));
    if (timingSafeEqual(expected, presented) && matched === null) {
      matched = current + delta;
    }
  }
  return matched;
}

/** Key URI understood by Google Authenticator, Microsoft Authenticator, 1Password... */
export function otpauthUri(params: {
  issuer: string;
  accountName: string;
  secret: Buffer;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  const query = new URLSearchParams({
    secret: base32Encode(params.secret),
    issuer: params.issuer,
    algorithm: TOTP_PARAMETERS.algorithm,
    digits: String(TOTP_PARAMETERS.digits),
    period: String(TOTP_PARAMETERS.periodSeconds),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}
