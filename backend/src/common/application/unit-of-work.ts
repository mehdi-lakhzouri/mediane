/**
 * Application port for atomic multi-repository work. Repositories called inside
 * `run` transparently join the same database transaction; nested calls reuse it.
 * Keep slow work (Argon2 hashing, emails) outside of `run`.
 */
export abstract class UnitOfWork {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
