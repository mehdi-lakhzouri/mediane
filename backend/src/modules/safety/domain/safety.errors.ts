import { AppError, ErrorKind } from '../../../common/errors';

export class MedicalEventNotFoundError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super('MEDICAL_EVENT_NOT_FOUND', 'This event does not exist.');
  }
}

export class IncidentNotFoundError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super('INCIDENT_NOT_FOUND', 'This incident does not exist.');
  }
}

/** A unit answered while no incident is open for its driver. */
export class NoActiveIncidentError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super('NO_ACTIVE_INCIDENT', 'There is no active incident to answer.');
  }
}

export class EventTimestampError extends AppError {
  readonly kind = ErrorKind.VALIDATION;

  constructor() {
    super(
      'EVENT_TIMESTAMP_INVALID',
      'The detection time is too old or in the future.',
    );
  }
}

/** The same idempotency key was reused for a different event. */
export class EventIdConflictError extends AppError {
  readonly kind = ErrorKind.CONFLICT;

  constructor() {
    super(
      'EVENT_ID_CONFLICT',
      'This event id was already used for a different event.',
    );
  }
}
