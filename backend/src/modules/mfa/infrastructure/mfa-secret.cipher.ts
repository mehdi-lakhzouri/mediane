import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { mfaConfig, type MfaConfig } from '../../../config';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * Encrypts TOTP secrets at rest (AES-256-GCM, authenticated). The user id is
 * bound as additional authenticated data: a ciphertext copied onto another
 * user's row does not decrypt. The version prefix leaves room for key rotation.
 * Format: v1.<iv>.<tag>.<ciphertext> (base64url).
 */
@Injectable()
export class MfaSecretCipher {
  constructor(@Inject(mfaConfig.KEY) private readonly config: MfaConfig) {}

  encrypt(secret: Buffer, userId: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.config.encryptionKey, iv);
    cipher.setAAD(Buffer.from(userId));
    const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
    return [
      VERSION,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  /** @throws if the payload was tampered with, or belongs to another user. */
  decrypt(payload: string, userId: string): Buffer {
    const [version, iv, tag, ciphertext] = payload.split('.');
    if (version !== VERSION || !iv || !tag || !ciphertext) {
      throw new Error('Unsupported MFA secret format');
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.config.encryptionKey,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]);
  }
}
