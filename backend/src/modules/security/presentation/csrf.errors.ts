import { AppError, ErrorKind } from '../../../common/errors';

export class CsrfValidationError extends AppError {
  readonly kind = ErrorKind.FORBIDDEN;

  constructor() {
    super('CSRF_VALIDATION_FAILED', 'The request could not be verified.');
  }
}
