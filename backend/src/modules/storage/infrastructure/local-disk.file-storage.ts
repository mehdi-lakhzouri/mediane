import { randomBytes } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { storageConfig, type StorageConfig } from '../../../config';
import { SecureTokenService } from '../../security/infrastructure/secure-token.service';
import {
  assertStorageKey,
  FileStorage,
  SignedDownloadUrl,
} from '../application/file-storage';

/**
 * Development storage: a folder on this server. Files are NOT served
 * statically; LocalFilesController streams them only for a valid, unexpired
 * signature, mirroring S3 pre-signed URLs so clients behave the same in both.
 * Not for production (single instance, lost with the container) — enforced by
 * the environment validation.
 */
@Injectable()
export class LocalDiskFileStorage implements FileStorage {
  constructor(
    @Inject(storageConfig.KEY) private readonly config: StorageConfig,
    private readonly tokens: SecureTokenService,
  ) {}

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    // Write then rename: a reader never sees a half-written file.
    const temporary = `${path}.${randomBytes(6).toString('hex')}.part`;
    await writeFile(temporary, data);
    await rename(temporary, path);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  signedDownloadUrl(
    key: string,
    ttlSeconds: number,
    now = new Date(),
  ): Promise<SignedDownloadUrl> {
    assertStorageKey(key);
    const expires = Math.floor(now.getTime() / 1000) + ttlSeconds;
    const query = new URLSearchParams({
      expires: String(expires),
      signature: this.sign(key, expires),
    });
    return Promise.resolve({
      url: `${this.config.local.publicBaseUrl}/${key}?${query.toString()}`,
      expiresAt: new Date(expires * 1000),
    });
  }

  /** Constant-time check of a download link. */
  isValidSignature(
    key: string,
    expires: number,
    signature: string,
    now = new Date(),
  ): boolean {
    return (
      Number.isSafeInteger(expires) &&
      expires * 1000 > now.getTime() &&
      this.tokens.safeEqual(this.sign(key, expires), signature)
    );
  }

  /** Only ever called with a validated key: no path traversal possible. */
  pathOf(key: string): string {
    assertStorageKey(key);
    return join(this.config.local.directory, ...key.split('/'));
  }

  private sign(key: string, expires: number): string {
    return this.tokens.hmac(`file-download:${key}:${expires}`);
  }
}
