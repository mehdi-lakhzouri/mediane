import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { storageConfig, type StorageConfig } from '../../../config';
import {
  assertStorageKey,
  FileStorage,
  SignedDownloadUrl,
} from '../application/file-storage';

/**
 * Production storage: any S3-compatible bucket (AWS S3, MinIO, Cloudflare R2).
 * The bucket must stay private (Block Public Access on); enable default
 * encryption at the bucket level. Keys are never reused (a new avatar gets a
 * new key), so objects can be cached as immutable.
 */
@Injectable()
export class S3FileStorage implements FileStorage, OnModuleDestroy {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(storageConfig.KEY) config: StorageConfig) {
    this.bucket = config.s3.bucket;
    this.client = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      forcePathStyle: config.s3.forcePathStyle,
      credentials: config.s3.credentials,
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    assertStorageKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: 'private, max-age=31536000, immutable',
      }),
    );
  }

  async delete(key: string): Promise<void> {
    assertStorageKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async signedDownloadUrl(
    key: string,
    ttlSeconds: number,
    now = new Date(),
  ): Promise<SignedDownloadUrl> {
    assertStorageKey(key);
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds, signingDate: now },
    );
    return { url, expiresAt: new Date(now.getTime() + ttlSeconds * 1000) };
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
