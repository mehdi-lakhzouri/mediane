import { AppError, ErrorDetail, ErrorKind } from '../../../common/errors';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export class WeakPasswordError extends AppError {
  readonly kind = ErrorKind.VALIDATION;

  constructor(details: readonly ErrorDetail[]) {
    super('WEAK_PASSWORD', 'The password does not meet the policy.', details);
  }
}

/**
 * Authoritative password policy (NIST SP 800-63B style: length over composition rules).
 * DTO decorators only pre-check the length; this runs in the use cases.
 * TODO: add a breached-password check (k-anonymity HIBP API) before production.
 */
export function assertPasswordPolicy(
  password: string,
  context: { email?: string } = {},
): void {
  const problems: ErrorDetail[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push({
      field: 'password',
      message: `must be at least ${PASSWORD_MIN_LENGTH} characters`,
    });
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    problems.push({
      field: 'password',
      message: `must be at most ${PASSWORD_MAX_LENGTH} characters`,
    });
  }
  const localPart = context.email?.split('@')[0]?.toLowerCase();
  if (
    localPart &&
    localPart.length >= 3 &&
    password.toLowerCase().includes(localPart)
  ) {
    problems.push({
      field: 'password',
      message: 'must not contain the email address',
    });
  }
  if (problems.length) throw new WeakPasswordError(problems);
}
