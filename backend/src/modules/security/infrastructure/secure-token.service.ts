import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { authConfig, type AuthConfig } from '../../../config';

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+?';
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

/**
 * Cryptographic primitives for opaque tokens (invitation, refresh, password reset).
 * Raw tokens are only ever sent to the client; the database stores `hashToken(raw)`.
 * HMAC (keyed) rather than plain SHA-256: a database dump alone cannot be used to
 * confirm token guesses offline.
 */
@Injectable()
export class SecureTokenService {
  constructor(@Inject(authConfig.KEY) private readonly auth: AuthConfig) {}

  /** 256 bits of entropy by default, URL-safe. */
  generateToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  hashToken(rawToken: string): string {
    return this.hmac(`token:${rawToken}`);
  }

  /** Domain-separated HMAC, reused by CSRF token signing. */
  hmac(value: string): string {
    return createHmac('sha256', this.auth.tokenHashSecret)
      .update(value)
      .digest('hex');
  }

  safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  /**
   * Unbiased (crypto.randomInt) temporary password containing every character class,
   * without ambiguous characters (0/O, 1/l/I). Never log the result.
   */
  generateTemporaryPassword(length = 20): string {
    const pick = (alphabet: string): string =>
      alphabet[randomInt(alphabet.length)];
    const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
    while (chars.length < length) chars.push(pick(ALL));
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }
}
