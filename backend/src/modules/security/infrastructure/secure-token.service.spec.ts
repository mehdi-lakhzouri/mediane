import type { AuthConfig } from '../../../config';
import { CsrfTokenService } from './csrf-token.service';
import { SecureTokenService } from './secure-token.service';

const config = {
  tokenHashSecret: 'test-token-hash-secret-at-least-32-chars',
} as AuthConfig;

describe('SecureTokenService', () => {
  const tokens = new SecureTokenService(config);

  it('generates 256-bit url-safe tokens', () => {
    const token = tokens.generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokens.generateToken()).not.toBe(token);
  });

  it('hashes deterministically without exposing the raw token', () => {
    const token = tokens.generateToken();
    const hash = tokens.hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens.hashToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  it('generates temporary passwords with every character class', () => {
    for (let i = 0; i < 50; i++) {
      const password = tokens.generateTemporaryPassword();
      expect(password).toHaveLength(20);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[2-9]/);
      expect(password).toMatch(/[!@#$%^&*\-_=+?]/);
    }
  });
});

describe('CsrfTokenService', () => {
  const csrf = new CsrfTokenService(new SecureTokenService(config));

  it('accepts a matching, correctly signed token', () => {
    const token = csrf.issue();
    expect(csrf.verify(token, token)).toBe(true);
  });

  it('rejects mismatching header and cookie', () => {
    expect(csrf.verify(csrf.issue(), csrf.issue())).toBe(false);
  });

  it('rejects forged tokens (valid shape, wrong signature)', () => {
    const forged = `${'a'.repeat(43)}.${'0'.repeat(64)}`;
    expect(csrf.verify(forged, forged)).toBe(false);
  });
});
