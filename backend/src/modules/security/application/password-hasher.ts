/** Port: one-way password hashing. Implemented with Argon2id. */
export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>;

  /** Never throws on malformed hashes: returns false. */
  abstract verify(hash: string, plain: string): Promise<boolean>;

  /** True when the stored hash uses outdated parameters (rehash on next login). */
  abstract needsRehash(hash: string): boolean;
}
