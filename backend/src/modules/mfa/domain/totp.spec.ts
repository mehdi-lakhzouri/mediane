import {
  generateRecoveryCodes,
  looksLikeRecoveryCode,
  normalizeRecoveryCode,
} from './recovery-codes';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  matchTotpStep,
  otpauthUri,
  timeStep,
  totpAt,
} from './totp';

// RFC 6238 Appendix B, SHA-1 seed "12345678901234567890" (8-digit values).
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');
const RFC_VECTORS: [number, string][] = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

describe('TOTP (RFC 6238)', () => {
  it.each(RFC_VECTORS)('matches the RFC vector at T=%i', (seconds, code) => {
    const at = new Date(seconds * 1000);
    expect(hotp(RFC_SECRET, timeStep(at), 8)).toBe(code);
    // The 6-digit code is the same truncation, modulo 10^6.
    expect(totpAt(RFC_SECRET, at)).toBe(code.slice(2));
  });

  it('accepts one step of drift each way and reports the matched step', () => {
    const now = new Date(1_700_000_000_000);
    const step = timeStep(now);
    const previous = hotp(RFC_SECRET, step - 1);
    const next = hotp(RFC_SECRET, step + 1);
    expect(matchTotpStep(RFC_SECRET, totpAt(RFC_SECRET, now), now)).toBe(step);
    expect(matchTotpStep(RFC_SECRET, previous, now)).toBe(step - 1);
    expect(matchTotpStep(RFC_SECRET, next, now)).toBe(step + 1);
    expect(matchTotpStep(RFC_SECRET, hotp(RFC_SECRET, step - 2), now)).toBe(
      null,
    );
  });

  it('rejects anything that is not exactly six digits', () => {
    const now = new Date();
    for (const code of ['', '12345', '1234567', 'abcdef', ' 123456']) {
      expect(matchTotpStep(RFC_SECRET, code, now)).toBeNull();
    }
  });
});

describe('base32 (RFC 4648)', () => {
  it.each([
    ['f', 'MY'],
    ['fo', 'MZXQ'],
    ['foo', 'MZXW6'],
    ['foob', 'MZXW6YQ'],
    ['fooba', 'MZXW6YTB'],
    ['foobar', 'MZXW6YTBOI'],
  ])('encodes %s as %s and back', (plain, encoded) => {
    expect(base32Encode(Buffer.from(plain))).toBe(encoded);
    expect(base32Decode(encoded).toString()).toBe(plain);
  });

  it('round-trips a generated 160-bit secret', () => {
    const secret = generateTotpSecret();
    expect(secret).toHaveLength(20);
    expect(base32Decode(base32Encode(secret)).equals(secret)).toBe(true);
  });
});

describe('otpauthUri', () => {
  it('builds a key URI authenticator apps can scan', () => {
    const uri = new URL(
      otpauthUri({
        issuer: 'Mediane',
        accountName: 'admin@cabinguard.test',
        secret: RFC_SECRET,
      }),
    );
    expect(uri.protocol).toBe('otpauth:');
    expect(uri.host).toBe('totp');
    expect(decodeURIComponent(uri.pathname)).toBe(
      '/Mediane:admin@cabinguard.test',
    );
    expect(Object.fromEntries(uri.searchParams)).toEqual({
      secret: base32Encode(RFC_SECRET),
      issuer: 'Mediane',
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    });
  });
});

describe('recovery codes', () => {
  it('generates 10 distinct, readable codes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
    }
  });

  it('normalizes what people type', () => {
    expect(normalizeRecoveryCode(' abcde-fgh23 ')).toBe('ABCDEFGH23');
    expect(looksLikeRecoveryCode('abcde fgh23')).toBe(true);
    expect(looksLikeRecoveryCode('123456')).toBe(false);
  });
});
