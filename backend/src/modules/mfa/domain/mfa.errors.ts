import { AppError, ErrorKind } from '../../../common/errors';

/** Wrong, expired, replayed TOTP code or unknown/used recovery code: one answer. */
export class InvalidMfaCodeError extends AppError {
  readonly kind = ErrorKind.VALIDATION;

  constructor() {
    super('MFA_CODE_INVALID', 'The verification code is not valid.', [
      { field: 'code', message: 'is not valid' },
    ]);
  }
}

/** A sensitive action needs a fresh code from a user who has MFA enabled. */
export class MfaCodeRequiredError extends AppError {
  readonly kind = ErrorKind.VALIDATION;

  constructor() {
    super(
      'MFA_CODE_REQUIRED',
      'Enter a code from your authenticator app (or a recovery code) to confirm.',
      [{ field: 'mfaCode', message: 'is required' }],
    );
  }
}

/** Unknown, expired, used-up or wrong-channel login challenge: indistinguishable. */
export class MfaChallengeInvalidError extends AppError {
  readonly kind = ErrorKind.UNAUTHENTICATED;

  constructor() {
    super(
      'MFA_CHALLENGE_INVALID',
      'This sign-in attempt has expired. Sign in again.',
    );
  }
}

export class MfaNotEnabledError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super('MFA_NOT_ENABLED', 'Two-step verification is not enabled.');
  }
}

export class MfaSetupNotStartedError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super(
      'MFA_SETUP_NOT_STARTED',
      'Start the authenticator setup again: it was not started or has expired.',
    );
  }
}

export class MfaRequiredForRoleError extends AppError {
  readonly kind = ErrorKind.FORBIDDEN;

  constructor() {
    super(
      'MFA_REQUIRED',
      'Two-step verification is mandatory for this account and cannot be turned off.',
    );
  }
}
