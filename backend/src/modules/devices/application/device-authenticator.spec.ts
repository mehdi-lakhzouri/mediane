import type { SafetyConfig } from '../../../config';
import { type DeviceCredentials, DeviceStatus } from '../domain/device';
import { DeviceAuthenticationError } from '../domain/device.errors';
import type { DeviceRepository } from '../domain/device.repository';
import { DeviceHeaders, signRequest } from '../domain/device-signature';
import { DeviceSecretCipher } from '../infrastructure/device-secret.cipher';
import {
  DeviceAuthenticator,
  type IncomingDeviceRequest,
} from './device-authenticator';

const config = {
  deviceEncryptionKey: Buffer.alloc(32, 3),
  signatureWindowSeconds: 300,
} as SafetyConfig;
const cipher = new DeviceSecretCipher(config);
const secret = Buffer.alloc(32, 5);
const now = new Date(1_790_000_000_000);
const PATH = '/api/v1/device/events';

function credentials(
  overrides: Partial<DeviceCredentials> = {},
): DeviceCredentials {
  const id = '0192a5c4-0000-7000-8000-0000000000aa';
  return {
    id,
    serialNumber: 'CG-UNIT-1',
    status: DeviceStatus.ACTIVE,
    pairedUserId: '0192a5c4-0000-7000-8000-0000000000bb',
    secretEnc: cipher.encrypt(secret, id),
    ...overrides,
  };
}

function signed(
  overrides: {
    body?: string;
    timestamp?: string;
    nonce?: string;
    key?: Buffer;
    serial?: string;
  } = {},
): IncomingDeviceRequest {
  const body = Buffer.from(overrides.body ?? '{"type":"STROKE"}');
  const timestamp = overrides.timestamp ?? String(now.getTime() / 1000);
  const nonce = overrides.nonce ?? 'nonce-abcdefghijkl';
  const headers: Record<string, string> = {
    [DeviceHeaders.SERIAL]: overrides.serial ?? 'CG-UNIT-1',
    [DeviceHeaders.TIMESTAMP]: timestamp,
    [DeviceHeaders.NONCE]: nonce,
    [DeviceHeaders.SIGNATURE]: signRequest(overrides.key ?? secret, {
      method: 'POST',
      path: PATH,
      timestamp,
      nonce,
      body,
    }),
  };
  return {
    method: 'POST',
    path: PATH,
    header: (name) => headers[name],
    rawBody: body,
  };
}

describe('DeviceAuthenticator', () => {
  let stored: DeviceCredentials | null;
  let seen: Set<string>;
  let authenticator: DeviceAuthenticator;

  beforeEach(() => {
    stored = credentials();
    seen = new Set();
    const repository = {
      findCredentials: (serial: string) =>
        Promise.resolve(stored?.serialNumber === serial ? stored : null),
      consumeNonce: (_id: string, nonce: string) => {
        if (seen.has(nonce)) return Promise.resolve(false);
        seen.add(nonce);
        return Promise.resolve(true);
      },
    } as unknown as DeviceRepository;
    authenticator = new DeviceAuthenticator(repository, cipher, config);
  });

  it('identifies a correctly signed request', async () => {
    await expect(authenticator.authenticate(signed(), now)).resolves.toEqual({
      id: stored!.id,
      serialNumber: 'CG-UNIT-1',
      pairedUserId: stored!.pairedUserId,
    });
  });

  it('rejects a replayed nonce', async () => {
    await authenticator.authenticate(signed(), now);
    await expect(authenticator.authenticate(signed(), now)).rejects.toThrow(
      DeviceAuthenticationError,
    );
  });

  it('does not burn the nonce of a forged request', async () => {
    await expect(
      authenticator.authenticate(signed({ key: Buffer.alloc(32, 6) }), now),
    ).rejects.toThrow(DeviceAuthenticationError);
    await expect(
      authenticator.authenticate(signed(), now),
    ).resolves.toBeTruthy();
  });

  it.each([
    ['a stale timestamp', { timestamp: String(now.getTime() / 1000 - 301) }],
    ['a short nonce', { nonce: 'short' }],
    ['an unknown serial', { serial: 'CG-UNKNOWN' }],
    ['a wrong key', { key: Buffer.alloc(32, 6) }],
  ])('rejects %s', async (_case, overrides) => {
    await expect(
      authenticator.authenticate(signed(overrides), now),
    ).rejects.toThrow(DeviceAuthenticationError);
  });

  it('rejects a body changed after signing', async () => {
    const request = signed();
    await expect(
      authenticator.authenticate(
        { ...request, rawBody: Buffer.from('{"type":"DROWSINESS"}') },
        now,
      ),
    ).rejects.toThrow(DeviceAuthenticationError);
  });

  it('rejects a revoked unit even with a valid signature', async () => {
    stored = credentials({ status: DeviceStatus.REVOKED });
    await expect(authenticator.authenticate(signed(), now)).rejects.toThrow(
      DeviceAuthenticationError,
    );
  });
});
