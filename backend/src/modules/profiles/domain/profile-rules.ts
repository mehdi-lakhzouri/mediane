import { AppError, ErrorDetail, ErrorKind } from '../../../common/errors';
import type { EmergencyContact, Gender } from './emergency-contact';

export const DRIVER_MIN_AGE = 18;
/** Plausibility bound: older dates of birth are almost certainly typos. */
export const DRIVER_MAX_AGE = 100;
export const MIN_EMERGENCY_CONTACTS = 1;
/** No business ceiling was set; this only bounds payload size and abuse. */
export const MAX_EMERGENCY_CONTACTS = 20;

/** What the driver submits to complete (or update) their profile. */
export interface ProfileDetails {
  phoneNumber: string;
  /** Calendar date (UTC midnight). */
  dateOfBirth: Date;
  gender: Gender;
  emergencyContacts: readonly EmergencyContact[];
}

export class ProfileValidationError extends AppError {
  readonly kind = ErrorKind.VALIDATION;

  constructor(details: readonly ErrorDetail[]) {
    super('PROFILE_INVALID', 'Some profile information is invalid.', details);
  }
}

/** Whole years between two calendar dates. */
export function ageOn(dateOfBirth: Date, today: Date): number {
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (today.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      today.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Business rules that format checks (DTO) cannot express. Every problem is
 * reported at once, each with the field path the client should highlight.
 */
export function assertProfileDetails(
  details: ProfileDetails,
  today: Date,
): void {
  const problems: ErrorDetail[] = [];

  const age = ageOn(details.dateOfBirth, today);
  if (details.dateOfBirth > today) {
    problems.push({ field: 'dateOfBirth', message: 'must be in the past' });
  } else if (age < DRIVER_MIN_AGE) {
    problems.push({
      field: 'dateOfBirth',
      message: `drivers must be at least ${DRIVER_MIN_AGE} years old`,
    });
  } else if (age > DRIVER_MAX_AGE) {
    problems.push({ field: 'dateOfBirth', message: 'is not plausible' });
  }

  const contacts = details.emergencyContacts;
  if (contacts.length < MIN_EMERGENCY_CONTACTS) {
    problems.push({
      field: 'emergencyContacts',
      message: `must contain at least ${MIN_EMERGENCY_CONTACTS} contact`,
    });
  }
  if (contacts.length > MAX_EMERGENCY_CONTACTS) {
    problems.push({
      field: 'emergencyContacts',
      message: `must contain at most ${MAX_EMERGENCY_CONTACTS} contacts`,
    });
  }

  const seen = new Set<string>();
  contacts.forEach((contact, index) => {
    const field = `emergencyContacts.${index}.phoneNumber`;
    if (contact.phoneNumber === details.phoneNumber) {
      problems.push({
        field,
        message: "must be someone else's number, not the driver's own",
      });
    } else if (seen.has(contact.phoneNumber)) {
      problems.push({ field, message: 'is already used by another contact' });
    }
    seen.add(contact.phoneNumber);
  });

  if (problems.length) throw new ProfileValidationError(problems);
}
