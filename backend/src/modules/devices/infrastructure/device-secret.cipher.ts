import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { safetyConfig, type SafetyConfig } from '../../../config';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * Encrypts device secrets at rest (AES-256-GCM). The device id is bound as
 * additional authenticated data, so a ciphertext copied onto another unit's
 * row does not decrypt. Format: v1.<iv>.<tag>.<ciphertext> (base64url).
 */
@Injectable()
export class DeviceSecretCipher {
  constructor(
    @Inject(safetyConfig.KEY) private readonly config: SafetyConfig,
  ) {}

  encrypt(secret: Buffer, deviceId: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(
      ALGORITHM,
      this.config.deviceEncryptionKey,
      iv,
    );
    cipher.setAAD(Buffer.from(deviceId));
    const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
    return [
      VERSION,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  /** @throws when tampered with or bound to another device. */
  decrypt(payload: string, deviceId: string): Buffer {
    const [version, iv, tag, ciphertext] = payload.split('.');
    if (version !== VERSION || !iv || !tag || !ciphertext) {
      throw new Error('Unsupported device secret format');
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.config.deviceEncryptionKey,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAAD(Buffer.from(deviceId));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]);
  }
}
