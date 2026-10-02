import {
  formatInviteCode,
  generateInviteCode,
  isWellFormedInviteCode,
  normalizeInviteCode,
} from './family';

describe('family invite codes', () => {
  it('generates 8 unambiguous characters', () => {
    const codes = new Set(Array.from({ length: 200 }, generateInviteCode));
    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
      expect(isWellFormedInviteCode(code)).toBe(true);
    }
  });

  it('reads codes the way people type and share them', () => {
    expect(normalizeInviteCode(' k7m4-qx9p ')).toBe('K7M4QX9P');
    expect(normalizeInviteCode('K7M4 QX9P')).toBe('K7M4QX9P');
    expect(formatInviteCode('K7M4QX9P')).toBe('K7M4-QX9P');
  });

  it('rejects codes with ambiguous or foreign characters', () => {
    expect(isWellFormedInviteCode('K7M4QX9O')).toBe(false); // O
    expect(isWellFormedInviteCode('K7M4QX91')).toBe(false); // 1
    expect(isWellFormedInviteCode('K7M4QX9')).toBe(false); // too short
  });
});
