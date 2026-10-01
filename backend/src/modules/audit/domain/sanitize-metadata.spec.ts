import { sanitizeAuditMetadata } from './sanitize-metadata';

describe('sanitizeAuditMetadata', () => {
  it('drops secret-looking keys at any depth', () => {
    expect(
      sanitizeAuditMetadata({
        role: 'DRIVER',
        password: 'p',
        temporaryPassword: 't',
        nested: { refreshToken: 'r', invitationTokenHash: 'h', kept: 1 },
      }),
    ).toEqual({ role: 'DRIVER', nested: { kept: 1 } });
  });

  it('serializes dates and drops non-JSON values', () => {
    const at = new Date('2026-01-01T00:00:00.000Z');
    expect(sanitizeAuditMetadata({ at, fn: () => 1, n: Number.NaN })).toEqual({
      at: '2026-01-01T00:00:00.000Z',
      n: null,
    });
  });

  it('returns null when nothing is left', () => {
    expect(sanitizeAuditMetadata({ token: 'x' })).toBeNull();
    expect(sanitizeAuditMetadata(undefined)).toBeNull();
  });
});
