import type { SafetyConfig } from '../../../config';
import { DeviceSecretCipher } from './device-secret.cipher';

const cipher = new DeviceSecretCipher({
  deviceEncryptionKey: Buffer.alloc(32, 1),
} as SafetyConfig);
const secret = Buffer.alloc(32, 9);
const deviceId = '0192a5c4-0000-7000-8000-000000000001';

describe('DeviceSecretCipher', () => {
  it('round-trips a secret for the same device', () => {
    const payload = cipher.encrypt(secret, deviceId);
    expect(payload).toMatch(/^v1\./);
    expect(payload).not.toContain(secret.toString('base64url'));
    expect(cipher.decrypt(payload, deviceId)).toEqual(secret);
  });

  it('refuses a ciphertext moved to another device', () => {
    const payload = cipher.encrypt(secret, deviceId);
    expect(() =>
      cipher.decrypt(payload, '0192a5c4-0000-7000-8000-000000000002'),
    ).toThrow();
  });

  it('refuses tampered or unknown payloads', () => {
    const [version, iv, tag, data] = cipher
      .encrypt(secret, deviceId)
      .split('.');
    const flipped = Buffer.from(data, 'base64url');
    flipped[0] ^= 1;
    expect(() =>
      cipher.decrypt(
        [version, iv, tag, flipped.toString('base64url')].join('.'),
        deviceId,
      ),
    ).toThrow();
    expect(() => cipher.decrypt(`v2.${iv}.${tag}.${data}`, deviceId)).toThrow();
  });
});
