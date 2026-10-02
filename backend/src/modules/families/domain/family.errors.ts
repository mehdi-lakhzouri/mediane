import { AppError, ErrorKind } from '../../../common/errors';
import { FamilyPolicy } from './family';

export class FamilyNotFoundError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super('FAMILY_NOT_FOUND', 'This family does not exist.');
  }
}

export class NotInFamilyError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super('NOT_IN_FAMILY', 'You are not part of a family.');
  }
}

export class AlreadyInFamilyError extends AppError {
  readonly kind = ErrorKind.CONFLICT;

  constructor(subject: 'you' | 'driver' = 'you') {
    super(
      'ALREADY_IN_FAMILY',
      subject === 'you'
        ? 'You are already part of a family. Leave it first.'
        : 'This driver is already part of a family.',
    );
  }
}

export class FamilyOwnerOnlyError extends AppError {
  readonly kind = ErrorKind.FORBIDDEN;

  constructor() {
    super('FAMILY_OWNER_ONLY', 'Only the family owner can do this.');
  }
}

export class FamilyFullError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super(
      'FAMILY_FULL',
      `A family can have at most ${FamilyPolicy.MAX_MEMBERS} members.`,
    );
  }
}

/** Unknown, expired and rotated codes are indistinguishable. */
export class FamilyInviteInvalidError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super(
      'FAMILY_INVITE_INVALID',
      'This family code is not valid. Ask the family owner for a new one.',
    );
  }
}

export class JoinRequestAlreadyPendingError extends AppError {
  readonly kind = ErrorKind.CONFLICT;

  constructor() {
    super(
      'JOIN_REQUEST_ALREADY_PENDING',
      'You already have a request waiting. Cancel it before asking another family.',
    );
  }
}

export class JoinRequestNotFoundError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super('JOIN_REQUEST_NOT_FOUND', 'This request no longer exists.');
  }
}

/** Already decided, cancelled or expired. */
export class JoinRequestClosedError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super(
      'JOIN_REQUEST_CLOSED',
      'This request was already handled or has expired.',
    );
  }
}

export class FamilyMemberNotFoundError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super('FAMILY_MEMBER_NOT_FOUND', 'This person is not in the family.');
  }
}

/** The owner removes others; to go themselves they use "leave". */
export class CannotRemoveYourselfError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super(
      'CANNOT_REMOVE_YOURSELF',
      'Use "leave the family" to remove yourself.',
    );
  }
}

export class NotADriverError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super('NOT_A_DRIVER', 'Only driver accounts can be family members.');
  }
}
