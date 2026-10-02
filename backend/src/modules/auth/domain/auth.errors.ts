import { AppError, ErrorKind } from '../../../common/errors';
import { AccountState } from '../../users/domain/account-state';

export class AuthenticationRequiredError extends AppError {
  readonly kind = ErrorKind.UNAUTHENTICATED;

  constructor() {
    super('AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }
}

/** Revoked/expired session, deleted/suspended user... deliberately indistinguishable. */
export class SessionInvalidError extends AppError {
  readonly kind = ErrorKind.UNAUTHENTICATED;

  constructor() {
    super('SESSION_INVALID', 'Your session is no longer valid.');
  }
}

/**
 * Same response for unknown email, wrong password, locked, invited or suspended
 * accounts: login must not reveal whether an account exists or its state.
 */
export class InvalidCredentialsError extends AppError {
  readonly kind = ErrorKind.UNAUTHENTICATED;

  constructor() {
    super('INVALID_CREDENTIALS', 'Invalid email or password.');
  }
}

/** Only raised AFTER a correct password: safe to be specific. */
export class TemporaryPasswordExpiredError extends AppError {
  readonly kind = ErrorKind.FORBIDDEN;

  constructor() {
    super(
      'TEMPORARY_PASSWORD_EXPIRED',
      'Your temporary password has expired. Ask an administrator for a new invitation.',
    );
  }
}

export class InvalidCurrentPasswordError extends AppError {
  readonly kind = ErrorKind.VALIDATION;

  constructor() {
    super('INVALID_CURRENT_PASSWORD', 'The current password is incorrect.', [
      { field: 'currentPassword', message: 'is incorrect' },
    ]);
  }
}

export class PasswordUnchangedError extends AppError {
  readonly kind = ErrorKind.VALIDATION;

  constructor() {
    super(
      'PASSWORD_UNCHANGED',
      'The new password must be different from the current one.',
      [
        {
          field: 'newPassword',
          message: 'must differ from the current password',
        },
      ],
    );
  }
}

/** Unknown, expired and already-used reset tokens are indistinguishable. */
export class InvalidPasswordResetTokenError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super(
      'PASSWORD_RESET_TOKEN_INVALID',
      'This password reset link is invalid or has expired.',
    );
  }
}

export class InsufficientPermissionsError extends AppError {
  readonly kind = ErrorKind.FORBIDDEN;

  constructor() {
    super('FORBIDDEN', 'You are not allowed to perform this action.');
  }
}

const RESTRICTION_CODES: Partial<Record<AccountState, string>> = {
  [AccountState.PASSWORD_CHANGE_REQUIRED]: 'PASSWORD_CHANGE_REQUIRED',
  [AccountState.MFA_SETUP_REQUIRED]: 'MFA_SETUP_REQUIRED',
  [AccountState.PROFILE_SETUP_REQUIRED]: 'PROFILE_SETUP_REQUIRED',
};

/** Raised server-side while onboarding is incomplete; the code tells the client where to go. */
export class AccountStateRestrictedError extends AppError {
  readonly kind = ErrorKind.FORBIDDEN;

  constructor(state: AccountState) {
    super(
      RESTRICTION_CODES[state] ?? 'ACCOUNT_STATE_FORBIDDEN',
      'Complete the required account steps before accessing this resource.',
    );
  }
}
