import { AppError, ErrorKind } from './app-error';

/** Marks a use case whose implementation is intentionally deferred (HTTP 501). */
export class NotImplementedError extends AppError {
  readonly kind = ErrorKind.NOT_IMPLEMENTED;

  constructor(readonly feature: string) {
    super('NOT_IMPLEMENTED', 'This feature is not available yet.');
  }
}

export function notImplemented(feature: string): never {
  throw new NotImplementedError(feature);
}
