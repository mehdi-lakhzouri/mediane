export interface SignedDownloadUrl {
  url: string;
  expiresAt: Date;
}

/**
 * Port for binary objects (driver avatars). Keys are opaque, server-generated
 * paths such as `avatars/<uuid>.webp`: never derived from client input. Objects
 * are private; clients only ever receive short-lived signed URLs.
 */
export abstract class FileStorage {
  abstract put(key: string, data: Buffer, contentType: string): Promise<void>;

  /** Idempotent: deleting a missing object is not an error. */
  abstract delete(key: string): Promise<void>;

  abstract signedDownloadUrl(
    key: string,
    ttlSeconds: number,
    now?: Date,
  ): Promise<SignedDownloadUrl>;
}

/** `<folder>/<name>.<ext>`, lowercase folder, no dots or slashes elsewhere. */
export const STORAGE_KEY_PATTERN = /^[a-z0-9-]+\/[A-Za-z0-9-]+\.[a-z0-9]+$/;

export function assertStorageKey(key: string): void {
  if (!STORAGE_KEY_PATTERN.test(key)) {
    throw new Error('Invalid storage key');
  }
}
