import { AppError, ErrorKind } from '../../../common/errors';

export class UserNotFoundError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super('USER_NOT_FOUND', 'User not found.');
  }
}

/** Only raised on admin/CLI paths: public flows must not reveal whether an email exists. */
export class EmailAlreadyInUseError extends AppError {
  readonly kind = ErrorKind.CONFLICT;

  constructor() {
    super('EMAIL_ALREADY_IN_USE', 'An account already uses this email.');
  }
}

export class AdminAlreadyExistsError extends AppError {
  readonly kind = ErrorKind.CONFLICT;

  constructor() {
    super(
      'ADMIN_ALREADY_EXISTS',
      'An administrator already exists. Use --allow-additional-admin to create another one.',
    );
  }
}
