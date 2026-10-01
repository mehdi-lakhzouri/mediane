import { AppError, ErrorKind } from '../../../common/errors';

/**
 * Unknown, expired, revoked, superseded and already-used tokens all produce this
 * same error: the public endpoint must not act as a token-status oracle.
 */
export class InvalidInvitationError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super('INVITATION_INVALID', 'This invitation is invalid or has expired.');
  }
}

export class InvitationNotFoundError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super('INVITATION_NOT_FOUND', 'Invitation not found.');
  }
}
