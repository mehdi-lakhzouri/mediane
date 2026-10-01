import { Injectable } from '@nestjs/common';
import { SecureTokenService } from './secure-token.service';

/**
 * Signed double-submit CSRF token: `<nonce>.<hmac(nonce)>`.
 * The server can verify it was issued by us without storing it; the attacker
 * cannot forge one (no key) nor read the victim's cookie (same-origin policy).
 */
@Injectable()
export class CsrfTokenService {
  constructor(private readonly tokens: SecureTokenService) {}

  issue(): string {
    const nonce = this.tokens.generateToken(32);
    return `${nonce}.${this.sign(nonce)}`;
  }

  /** Header value must equal the cookie value, and the cookie must carry a valid signature. */
  verify(cookieToken: string, headerToken: string): boolean {
    if (!this.tokens.safeEqual(cookieToken, headerToken)) return false;
    const [nonce, signature, ...rest] = cookieToken.split('.');
    if (!nonce || !signature || rest.length) return false;
    return this.tokens.safeEqual(signature, this.sign(nonce));
  }

  private sign(nonce: string): string {
    return this.tokens.hmac(`csrf:${nonce}`);
  }
}
