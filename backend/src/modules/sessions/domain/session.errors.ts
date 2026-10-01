import { AppError, ErrorKind } from '../../../common/errors';

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
