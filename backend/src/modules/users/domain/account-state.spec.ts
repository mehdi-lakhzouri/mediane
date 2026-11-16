import {
  AccountState,
  AccountStateFacts,
  canAuthenticate,
  deriveAccountState,
} from './account-state';
import { Role } from './role';
import { UserStatus } from './user-status';

const activeDriver: AccountStateFacts = {
  role: Role.DRIVER,
  status: UserStatus.ACTIVE,
  mustChangePassword: false,
  mfaEnabledAt: null,
  profileCompletedAt: new Date(),
  deletedAt: null,
};

const activeAdmin: AccountStateFacts = {
  ...activeDriver,
  role: Role.ADMIN,
  mfaEnabledAt: new Date(),
};

describe('deriveAccountState', () => {
  it('returns ACTIVE for a fully onboarded driver', () => {
    expect(deriveAccountState(activeDriver)).toBe(AccountState.ACTIVE);
  });

  it('requires a password change before profile setup', () => {
    expect(
      deriveAccountState({
        ...activeDriver,
        mustChangePassword: true,
        profileCompletedAt: null,
      }),
    ).toBe(AccountState.PASSWORD_CHANGE_REQUIRED);
  });

  it('requires profile setup for drivers only', () => {
    const facts = { ...activeDriver, profileCompletedAt: null };
    expect(deriveAccountState(facts)).toBe(AccountState.PROFILE_SETUP_REQUIRED);
    expect(
      deriveAccountState({ ...activeAdmin, profileCompletedAt: null }),
    ).toBe(AccountState.ACTIVE);
  });

  it('keeps MFA optional for administrators', () => {
    expect(deriveAccountState(activeAdmin)).toBe(AccountState.ACTIVE);
    expect(deriveAccountState({ ...activeAdmin, mfaEnabledAt: null })).toBe(
      AccountState.ACTIVE,
    );
    expect(
      deriveAccountState({
        ...activeAdmin,
        mfaEnabledAt: null,
        mustChangePassword: true,
      }),
    ).toBe(AccountState.PASSWORD_CHANGE_REQUIRED);
  });

  it('keeps MFA optional for drivers', () => {
    expect(deriveAccountState({ ...activeDriver, mfaEnabledAt: null })).toBe(
      AccountState.ACTIVE,
    );
  });

  it('gives deletion precedence over suspension and onboarding', () => {
    expect(
      deriveAccountState({
        ...activeDriver,
        status: UserStatus.SUSPENDED,
        mustChangePassword: true,
        deletedAt: new Date(),
      }),
    ).toBe(AccountState.DELETED);
  });

  it('keeps invited users out until the invitation is accepted', () => {
    expect(
      deriveAccountState({
        ...activeDriver,
        status: UserStatus.INVITED,
        mustChangePassword: true,
      }),
    ).toBe(AccountState.INVITED);
  });
});

describe('canAuthenticate', () => {
  it.each([
    [AccountState.ACTIVE, true],
    [AccountState.PASSWORD_CHANGE_REQUIRED, true],
    [AccountState.MFA_SETUP_REQUIRED, true],
    [AccountState.PROFILE_SETUP_REQUIRED, true],
    [AccountState.INVITED, false],
    [AccountState.SUSPENDED, false],
    [AccountState.DELETED, false],
  ])('%s -> %s', (state, expected) => {
    expect(canAuthenticate(state)).toBe(expected);
  });
});
