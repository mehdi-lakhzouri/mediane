/**
 * Transport-agnostic error categories. Domain and application layers only know
 * these kinds; the HTTP layer maps them to status codes (common/http/errors).
 */
export const ErrorKind = {
  VALIDATION: 'VALIDATION',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BUSINESS_RULE: 'BUSINESS_RULE',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;
export type ErrorKind = (typeof ErrorKind)[keyof typeof ErrorKind];

export interface ErrorDetail {
  field?: string;
  message: string;
}

/**
 * Base class for every expected (non-bug) error. `code` is a stable,
 * machine-readable identifier exposed to API clients; `message` must be safe
 * to show to end users (no internal details, no secrets).
 */
export abstract class AppError extends Error {
  abstract readonly kind: ErrorKind;

  protected constructor(
    readonly code: string,
    message: string,
    readonly details?: readonly ErrorDetail[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}
