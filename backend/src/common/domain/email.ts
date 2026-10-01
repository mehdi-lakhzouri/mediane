import { AppError, ErrorKind } from '../errors';

// Pragmatic syntax check; deliverability is proven by the invitation flow.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;

export class InvalidEmailError extends AppError {
  readonly kind = ErrorKind.VALIDATION;

  constructor() {
    super('INVALID_EMAIL', 'The email address is invalid.', [
      { field: 'email', message: 'must be a valid email address' },
    ]);
  }
}

/**
 * Normalized email value object (trimmed, lower-cased). Every lookup and
 * uniqueness check goes through it so "A@x.io" and "a@x.io" are the same account.
 */
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (
      normalized.length > EMAIL_MAX_LENGTH ||
      !EMAIL_PATTERN.test(normalized)
    ) {
      throw new InvalidEmailError();
    }
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
