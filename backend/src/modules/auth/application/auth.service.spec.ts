import type { ClientContext } from '../../../common/application/client-context';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { Email } from '../../../common/domain/email';
import type { AppConfig, AuthConfig } from '../../../config';
import type { AuditService } from '../../audit/application/audit.service';
import type { MailSender } from '../../mail/application/mail-sender';
import type { PasswordHasher } from '../../security/application/password-hasher';
import type { SecureTokenService } from '../../security/infrastructure/secure-token.service';
import type { SessionsService } from '../../sessions/application/sessions.service';
import { RefreshSession } from '../../sessions/domain/refresh-session';
import { Role } from '../../users/domain/role';
import { User, UserProps } from '../../users/domain/user';
import { UserStatus } from '../../users/domain/user-status';
import type { UserRepository } from '../../users/domain/user.repository';
import {
  InvalidCredentialsError,
  TemporaryPasswordExpiredError,
} from '../domain/auth.errors';
import { LoginPolicy } from '../domain/login-policy';
import type { PasswordResetTokenRepository } from '../domain/password-reset-token.repository';
import type { AccessTokenIssuer } from '../infrastructure/access-token.issuer';
import { AuthService } from './auth.service';

const NOW = new Date();
const client: ClientContext = {
  requestId: 'r',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
};

function makeUser(overrides: Partial<UserProps> = {}): User {
  return User.rehydrate({
    id: 'u1',
    email: Email.create('driver@cabinguard.test'),
    passwordHash: 'stored-hash',
    role: Role.DRIVER,
    status: UserStatus.ACTIVE,
    firstName: 'Dan',
    lastName: 'Driver',
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    passwordChangedAt: null,
    emailVerifiedAt: NOW,
    profileCompletedAt: NOW,
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    suspendedAt: null,
    deletedAt: null,
    createdById: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

describe('AuthService.login', () => {
  let users: jest.Mocked<
    Pick<
      UserRepository,
      | 'findByEmail'
      | 'incrementFailedLoginAttempts'
      | 'lockLogin'
      | 'recordSuccessfulLogin'
    >
  >;
  let hasher: jest.Mocked<PasswordHasher>;
  let sessions: { open: jest.Mock };
  let audit: { record: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      incrementFailedLoginAttempts: jest.fn(),
      lockLogin: jest.fn(),
      recordSuccessfulLogin: jest.fn(),
    };
    hasher = {
      hash: jest.fn().mockResolvedValue('dummy-hash'),
      verify: jest.fn(),
      needsRehash: jest.fn().mockReturnValue(false),
    };
    sessions = {
      open: jest.fn().mockResolvedValue({
        session: RefreshSession.rehydrate({
          id: 's1',
          userId: 'u1',
          expiresAt: NOW,
          absoluteExpiresAt: NOW,
          persistent: false,
          lastUsedAt: null,
          revokedAt: null,
          revokedReason: null,
          createdAt: NOW,
        }),
        refreshToken: 'raw-refresh',
        refreshTokenExpiresAt: NOW,
      }),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const unitOfWork: UnitOfWork = { run: (work) => work() };
    const accessTokens = {
      issue: jest.fn().mockReturnValue({ token: 'jwt', expiresAt: NOW }),
    };

    service = new AuthService(
      users as unknown as UserRepository,
      hasher,
      sessions as unknown as SessionsService,
      accessTokens as unknown as AccessTokenIssuer,
      {} as SecureTokenService,
      {} as PasswordResetTokenRepository,
      {} as MailSender,
      audit as unknown as AuditService,
      unitOfWork,
      {} as AuthConfig,
      {} as AppConfig,
    );
  });

  const login = (password = 'secret-password') =>
    service.login({
      email: 'driver@cabinguard.test',
      password,
      rememberMe: false,
      client,
    });

  it('still runs an Argon2 verification for unknown emails', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(login()).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(hasher.verify).toHaveBeenCalledWith('dummy-hash', 'secret-password');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_FAILED',
        metadata: { reason: 'UNKNOWN_ACCOUNT' },
      }),
    );
  });

  it(`locks the account after ${LoginPolicy.MAX_FAILED_ATTEMPTS} failures`, async () => {
    users.findByEmail.mockResolvedValue(makeUser());
    hasher.verify.mockResolvedValue(false);
    users.incrementFailedLoginAttempts.mockResolvedValue(
      LoginPolicy.MAX_FAILED_ATTEMPTS,
    );
    await expect(login()).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(users.lockLogin).toHaveBeenCalledWith('u1', expect.any(Date));
  });

  it('answers INVALID_CREDENTIALS while locked, without checking the real hash', async () => {
    users.findByEmail.mockResolvedValue(
      makeUser({ lockedUntil: new Date(Date.now() + 60_000) }),
    );
    hasher.verify.mockResolvedValue(true);
    await expect(login()).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(hasher.verify).not.toHaveBeenCalledWith(
      'stored-hash',
      expect.anything(),
    );
  });

  it('hides suspended and invited accounts behind INVALID_CREDENTIALS', async () => {
    hasher.verify.mockResolvedValue(true);
    for (const status of [UserStatus.SUSPENDED, UserStatus.INVITED]) {
      users.findByEmail.mockResolvedValue(makeUser({ status }));
      await expect(login()).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    expect(sessions.open).not.toHaveBeenCalled();
  });

  it('rejects an expired temporary password', async () => {
    users.findByEmail.mockResolvedValue(
      makeUser({
        mustChangePassword: true,
        temporaryPasswordExpiresAt: new Date(Date.now() - 1),
      }),
    );
    hasher.verify.mockResolvedValue(true);
    await expect(login()).rejects.toBeInstanceOf(TemporaryPasswordExpiredError);
  });

  it('opens a new session and reports the onboarding state', async () => {
    users.findByEmail.mockResolvedValue(
      makeUser({ mustChangePassword: true, profileCompletedAt: null }),
    );
    hasher.verify.mockResolvedValue(true);
    hasher.needsRehash.mockReturnValue(true);
    hasher.hash.mockResolvedValue('upgraded-hash');

    const tokens = await login();

    expect(sessions.open).toHaveBeenCalledWith(
      'u1',
      client,
      { persistent: false },
      expect.any(Date),
    );
    expect(users.recordSuccessfulLogin).toHaveBeenCalledWith(
      'u1',
      expect.any(Date),
      'upgraded-hash',
    );
    expect(tokens.principal).toEqual({
      userId: 'u1',
      sessionId: 's1',
      role: Role.DRIVER,
      accountState: 'PASSWORD_CHANGE_REQUIRED',
    });
    expect(tokens.persistent).toBe(false);
  });
});
