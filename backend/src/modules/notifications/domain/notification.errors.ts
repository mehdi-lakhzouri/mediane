import { AppError, ErrorKind } from '../../../common/errors';

export class NotificationNotFoundError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super('NOTIFICATION_NOT_FOUND', 'This notification does not exist.');
  }
}
