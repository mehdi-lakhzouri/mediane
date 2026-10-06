import { AppError, ErrorKind } from '../../../common/errors';

export class SessionNotFoundError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super('SESSION_NOT_FOUND', 'This device is not signed in.');
  }
}

/** The current device signs out with logout, which also clears its tokens. */
export class CurrentSessionRevocationError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super(
      'SESSION_IS_CURRENT',
      'Use sign out to end the session on this device.',
    );
  }
}

/**
 * Missing, unknown, expired, revoked, rotated or replayed refresh token.
 * One public code for all cases: the endpoint must not reveal which one it was.
 */
export class InvalidRefreshTokenError extends AppError {
  readonly kind = ErrorKind.UNAUTHENTICATED;

  constructor() {
    super('SESSION_INVALID', 'Your session is no longer valid.');
  }
}
