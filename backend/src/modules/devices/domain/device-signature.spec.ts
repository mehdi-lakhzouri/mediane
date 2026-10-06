import {
  canonicalRequest,
  isFreshTimestamp,
  isValidSignature,
  signRequest,
  type SignedRequestParts,
} from './device-signature';

const secret = Buffer.alloc(32, 7);
const parts: SignedRequestParts = {
  method: 'post',
  path: '/api/v1/device/events',
  timestamp: '1790000000',
  nonce: 'nonce-0123456789ab',
  body: Buffer.from('{"type":"STROKE"}'),
};

describe('device request signature', () => {
  it('canonicalizes method, path, timestamp, nonce and body hash', () => {
    const lines = canonicalRequest(parts).split('\n');
    expect(lines.slice(0, 4)).toEqual([
      'POST',
      '/api/v1/device/events',
      '1790000000',
      'nonce-0123456789ab',
    ]);
    expect(lines[4]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts its own signature', () => {
    expect(isValidSignature(secret, parts, signRequest(secret, parts))).toBe(
      true,
    );
  });

  it.each([
    ['body', { body: Buffer.from('{"type":"DROWSINESS"}') }],
    ['path', { path: '/api/v1/device/acknowledge' }],
    ['timestamp', { timestamp: '1790000001' }],
    ['nonce', { nonce: 'nonce-0123456789ac' }],
  ])('rejects a request whose %s was changed', (_field, change) => {
    const signature = signRequest(secret, parts);
    expect(isValidSignature(secret, { ...parts, ...change }, signature)).toBe(
      false,
    );
  });

  it('rejects another secret and malformed signatures', () => {
    const signature = signRequest(secret, parts);
    expect(isValidSignature(Buffer.alloc(32, 8), parts, signature)).toBe(false);
    expect(isValidSignature(secret, parts, 'not-hex')).toBe(false);
    expect(isValidSignature(secret, parts, signature.slice(2))).toBe(false);
  });

  it('accepts timestamps within the window only', () => {
    const now = new Date(1_790_000_000_000);
    expect(isFreshTimestamp('1790000000', now, 300)).toBe(true);
    expect(isFreshTimestamp('1790000300', now, 300)).toBe(true);
    expect(isFreshTimestamp('1789999699', now, 300)).toBe(false);
    expect(isFreshTimestamp('1790000301', now, 300)).toBe(false);
    expect(isFreshTimestamp('1790000000000', now, 300)).toBe(false);
    expect(isFreshTimestamp('abc', now, 300)).toBe(false);
  });
});
