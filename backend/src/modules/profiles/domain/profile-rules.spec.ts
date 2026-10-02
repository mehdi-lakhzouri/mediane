import {
  ageOn,
  assertProfileDetails,
  MAX_EMERGENCY_CONTACTS,
  ProfileDetails,
  ProfileValidationError,
} from './profile-rules';

const TODAY = new Date('2026-10-02T09:30:00.000Z');
const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function details(overrides: Partial<ProfileDetails> = {}): ProfileDetails {
  return {
    phoneNumber: '+21612345678',
    dateOfBirth: date('1990-05-17'),
    gender: 'MALE',
    emergencyContacts: [
      {
        fullName: 'Amira Ben Salah',
        relationship: 'SPOUSE',
        phoneNumber: '+21698765432',
        priority: 1,
      },
    ],
    ...overrides,
  };
}

function problemsOf(input: ProfileDetails): string[] {
  try {
    assertProfileDetails(input, TODAY);
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(ProfileValidationError);
    return ((error as ProfileValidationError).details ?? []).map(
      (detail) => `${detail.field}: ${detail.message}`,
    );
  }
}

describe('ageOn', () => {
  it('counts a birthday only once it has been reached', () => {
    expect(ageOn(date('2008-10-02'), TODAY)).toBe(18);
    expect(ageOn(date('2008-10-03'), TODAY)).toBe(17);
    expect(ageOn(date('2000-02-29'), date('2026-02-28'))).toBe(25);
  });
});

describe('assertProfileDetails', () => {
  it('accepts a complete, coherent profile', () => {
    expect(problemsOf(details())).toEqual([]);
  });

  it('accepts a driver on their 18th birthday, not the day before', () => {
    expect(problemsOf(details({ dateOfBirth: date('2008-10-02') }))).toEqual(
      [],
    );
    expect(problemsOf(details({ dateOfBirth: date('2008-10-03') }))).toEqual([
      'dateOfBirth: drivers must be at least 18 years old',
    ]);
  });

  it('rejects future and implausible dates of birth', () => {
    expect(problemsOf(details({ dateOfBirth: date('2030-01-01') }))).toEqual([
      'dateOfBirth: must be in the past',
    ]);
    expect(problemsOf(details({ dateOfBirth: date('1900-01-01') }))).toEqual([
      'dateOfBirth: is not plausible',
    ]);
  });

  it('requires at least one emergency contact and caps the list', () => {
    expect(problemsOf(details({ emergencyContacts: [] }))).toEqual([
      'emergencyContacts: must contain at least 1 contact',
    ]);
    const tooMany = Array.from(
      { length: MAX_EMERGENCY_CONTACTS + 1 },
      (_, i) => ({
        fullName: `Contact ${i}`,
        relationship: 'FRIEND' as const,
        phoneNumber: `+2169000${String(i).padStart(4, '0')}`,
        priority: i + 1,
      }),
    );
    expect(problemsOf(details({ emergencyContacts: tooMany }))).toEqual([
      `emergencyContacts: must contain at most ${MAX_EMERGENCY_CONTACTS} contacts`,
    ]);
  });

  it("rejects the driver's own number and duplicated contact numbers", () => {
    const own = details({
      emergencyContacts: [
        {
          fullName: 'Me',
          relationship: 'OTHER',
          phoneNumber: '+21612345678',
          priority: 1,
        },
        {
          fullName: 'A',
          relationship: 'PARENT',
          phoneNumber: '+21698765432',
          priority: 2,
        },
        {
          fullName: 'B',
          relationship: 'SIBLING',
          phoneNumber: '+21698765432',
          priority: 3,
        },
      ],
    });
    expect(problemsOf(own)).toEqual([
      "emergencyContacts.0.phoneNumber: must be someone else's number, not the driver's own",
      'emergencyContacts.2.phoneNumber: is already used by another contact',
    ]);
  });
});
