import { AppError, ErrorKind } from '../../../common/errors';

/** An administrator may not suspend, delete or lock themselves out. */
export class CannotActOnSelfError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor(action: string) {
    super('CANNOT_ACT_ON_SELF', `You cannot ${action} your own account.`);
  }
}

/** Hard delete is only ever reachable for an already soft-deleted account. */
export class UserNotSoftDeletedError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super(
      'USER_NOT_SOFT_DELETED',
      'Delete the account first. Permanent deletion only applies to an already deleted account.',
    );
  }
}

export class HardDeleteConfirmationMismatchError extends AppError {
  readonly kind = ErrorKind.VALIDATION;

  constructor() {
    super(
      'CONFIRMATION_MISMATCH',
      'The email you typed does not match this account.',
      [{ field: 'confirmEmail', message: 'must match the account email' }],
    );
  }
}

export class UserAlreadyInStateError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor(message: string) {
    super('USER_ALREADY_IN_STATE', message);
  }
}
