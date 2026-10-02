import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getStorageToken } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { MailSender } from '../src/modules/mail/application/mail-sender';
import {
  base32Decode,
  hotp,
  timeStep,
  totpAt,
} from '../src/modules/mfa/domain/totp';
import { MfaSecretCipher } from '../src/modules/mfa/infrastructure/mfa-secret.cipher';
import { PasswordHasher } from '../src/modules/security/application/password-hasher';
import { CookieJar } from './utils/cookie-jar';
import { enrollTotp, freshCode, webLoginWithMfa } from './utils/mfa';

/**
 * Two-step verification end to end against PostgreSQL: mandatory setup for
 * administrators, the login challenge, recovery codes, step-up on sensitive
 * actions, replacement, admin reset, and optional MFA for drivers on mobile.
 */
const API = '/api/v1';
const ORIGIN = 'http://localhost:3000';
const CSRF = 'cg_csrf';
const TEMPORARY_PASSWORD = 'Temporary-Admin-Pass-2026!';
const ADMIN_PASSWORD = 'Admin-Own-Strong-Passphrase-1';
const OTHER_ADMIN_PASSWORD = 'Other-Admin-Passphrase-2';
const DRIVER_PASSWORD = 'Driver-Mfa-Passphrase-3';

interface Envelope<T> {
  data: T | null;
  error: { code: string; details?: { field?: string }[] } | null;
}
interface MfaStatus {
  enabled: boolean;
  required: boolean;
  recoveryCodesRemaining: number;
  recoveryCodesLow: boolean;
}
interface TotpSetup {
  secret: string;
  otpauthUri: string;
  accountName: string;
  expiresAt: string;
}
interface RecoveryCodes {
  recoveryCodes: string[];
  accountState: string;
}
interface LoginResponse {
  mfaRequired: boolean;
  mfaToken?: string;
  accountState?: string;
  accessToken?: string;
}

const body = <T>(res: { body: unknown }) => res.body as Envelope<T>;
const codeOf = (res: { body: unknown }) => body(res).error?.code;

describe('Two-step verification (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let prisma: PrismaService;
  const stamp = Date.now();
  const adminEmail = `mfa-admin-${stamp}@cabinguard.test`;
  const otherAdminEmail = `mfa-other-${stamp}@cabinguard.test`;
  const driverEmail = `mfa-driver-${stamp}@cabinguard.test`;
  const createdIds: string[] = [];
  let adminId: string;
  let otherAdminId: string;
  let otherAdminSecret: Buffer;
  let driverId: string;

  /** The admin's authenticator, as their phone would hold it. */
  let adminSecret: Buffer;
  let recoveryCodes: string[];
  let jar: CookieJar;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getStorageToken())
      .useValue({
        increment: () =>
          Promise.resolve({
            totalHits: 1,
            timeToExpire: 60,
            isBlocked: false,
            timeToBlockExpire: 0,
          }),
      })
      .overrideProvider(MailSender)
      .useValue({
        sendInvitation: () => Promise.resolve(),
        sendInvitationResend: () => Promise.resolve(),
        sendPasswordReset: () => Promise.resolve(),
      })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    const hasher = app.get(PasswordHasher);
    const base = {
      status: 'ACTIVE' as const,
      lastName: 'Mfa',
      emailVerifiedAt: new Date(),
    };
    // An invited administrator who accepted the invitation.
    const admin = await prisma.user.create({
      data: {
        ...base,
        email: adminEmail,
        passwordHash: await hasher.hash(TEMPORARY_PASSWORD),
        role: 'ADMIN',
        firstName: 'Invited',
        mustChangePassword: true,
        temporaryPasswordExpiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const other = await prisma.user.create({
      data: {
        ...base,
        email: otherAdminEmail,
        passwordHash: await hasher.hash(OTHER_ADMIN_PASSWORD),
        role: 'ADMIN',
        firstName: 'Other',
      },
    });
    const driver = await prisma.user.create({
      data: {
        ...base,
        email: driverEmail,
        passwordHash: await hasher.hash(DRIVER_PASSWORD),
        role: 'DRIVER',
        firstName: 'Driver',
        profileCompletedAt: new Date(),
      },
    });
    adminId = admin.id;
    otherAdminId = other.id;
    driverId = driver.id;
    createdIds.push(admin.id, other.id, driver.id);
    otherAdminSecret = await enrollTotp(app, prisma, other.id);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { targetId: { in: createdIds } },
          { actorUserId: { in: createdIds } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  // --- helpers ---------------------------------------------------------------

  async function browser(): Promise<CookieJar> {
    return new CookieJar().absorb(
      await request(server).get(`${API}/auth/csrf`).expect(200),
    );
  }

  function post(path: string, cookies: CookieJar, payload: object = {}) {
    return request(server)
      .post(`${API}${path}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookies.header())
      .set('X-CSRF-Token', cookies.get(CSRF) ?? '')
      .send(payload);
  }

  const get = (path: string, cookies: CookieJar) =>
    request(server).get(`${API}${path}`).set('Cookie', cookies.header());

  async function adminLoginStep(
    password = ADMIN_PASSWORD,
  ): Promise<{ jar: CookieJar; mfaToken: string }> {
    const cookies = await browser();
    const res = await post('/auth/login', cookies, {
      email: adminEmail,
      password,
    }).expect(200);
    const data = body<LoginResponse>(res).data!;
    expect(data.mfaRequired).toBe(true);
    return { jar: cookies, mfaToken: data.mfaToken! };
  }

  const unlock = () =>
    prisma.user.update({
      where: { id: adminId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

  // --- mandatory setup for administrators -------------------------------------

  it('blocks the console until an invited admin has set up an authenticator', async () => {
    jar = await browser();
    jar.absorb(
      await post('/auth/login', jar, {
        email: adminEmail,
        password: TEMPORARY_PASSWORD,
      }).expect(200),
    );
    const changed = await post('/auth/password/change', jar, {
      currentPassword: TEMPORARY_PASSWORD,
      newPassword: ADMIN_PASSWORD,
    }).expect(200);
    jar.absorb(changed);
    expect(body<LoginResponse>(changed).data?.accountState).toBe(
      'MFA_SETUP_REQUIRED',
    );

    const blocked = await get('/admin/users', jar).expect(403);
    expect(codeOf(blocked)).toBe('MFA_SETUP_REQUIRED');

    const status = await get('/auth/mfa', jar).expect(200);
    expect(body<MfaStatus>(status).data).toMatchObject({
      enabled: false,
      required: true,
    });
  });

  it('starts a setup: secret and otpauth URI, stored encrypted', async () => {
    const res = await post('/auth/mfa/totp/setup', jar).expect(200);
    const setup = body<TotpSetup>(res).data!;
    expect(setup.accountName).toBe(adminEmail);
    expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
    const uri = new URL(setup.otpauthUri);
    expect(uri.searchParams.get('secret')).toBe(setup.secret);
    expect(uri.searchParams.get('issuer')).toBe('CabinGuard');
    adminSecret = base32Decode(setup.secret);

    const row = await prisma.userMfa.findUniqueOrThrow({
      where: { userId: adminId },
    });
    expect(row.totpSecretEnc).toBeNull(); // not active before confirmation
    expect(row.pendingTotpSecretEnc).not.toContain(setup.secret);
    expect(row.pendingTotpSecretEnc).toMatch(/^v1\./);
    // Bound to its owner: the ciphertext does not decrypt for another user.
    const cipher = app.get(MfaSecretCipher);
    expect(
      cipher.decrypt(row.pendingTotpSecretEnc!, adminId).equals(adminSecret),
    ).toBe(true);
    expect(() => cipher.decrypt(row.pendingTotpSecretEnc!, driverId)).toThrow();
  });

  it('confirms the setup with a code and returns 10 recovery codes, once', async () => {
    const wrong = await post('/auth/mfa/totp/confirm', jar, {
      code: '000000',
    }).expect(400);
    expect(codeOf(wrong)).toBe('MFA_CODE_INVALID');

    const res = await post('/auth/mfa/totp/confirm', jar, {
      code: totpAt(adminSecret, new Date()),
    }).expect(200);
    const result = body<RecoveryCodes>(res).data!;
    recoveryCodes = result.recoveryCodes;
    expect(result.accountState).toBe('ACTIVE');
    expect(recoveryCodes).toHaveLength(10);
    expect(new Set(recoveryCodes).size).toBe(10);

    await get('/admin/users', jar).expect(200);
    const stored = await prisma.mfaRecoveryCode.findMany({
      where: { userId: adminId },
    });
    expect(stored).toHaveLength(10);
    for (const code of recoveryCodes) {
      expect(stored.some((r) => r.codeHash.includes(code))).toBe(false);
    }
  });

  it('never lets an administrator turn MFA off', async () => {
    const res = await post('/auth/mfa/totp/disable', jar, {
      code: await freshCode(prisma, adminId, adminSecret),
    }).expect(403);
    expect(codeOf(res)).toBe('MFA_REQUIRED');
  });

  // --- login challenge ---------------------------------------------------------

  it('answers a correct password with a challenge, not a session', async () => {
    const cookies = await browser();
    const res = await post('/auth/login', cookies, {
      email: adminEmail,
      password: ADMIN_PASSWORD,
    }).expect(200);
    expect(body<LoginResponse>(res).data).toEqual({
      mfaRequired: true,
      mfaToken: expect.any(String),
      expiresAt: expect.any(String),
    });
    const setCookies = res.get('Set-Cookie') ?? [];
    expect(setCookies.some((c) => c.startsWith('cg_at='))).toBe(false);
  });

  it('opens the session with the code; the challenge and the code are single-use', async () => {
    const { jar: cookies, mfaToken } = await adminLoginStep();
    const code = await freshCode(prisma, adminId, adminSecret);

    const ok = await post('/auth/mfa/challenge', cookies, {
      mfaToken,
      code,
    }).expect(200);
    cookies.absorb(ok);
    await get('/admin/users', cookies).expect(200);

    // Same challenge again.
    const reused = await post('/auth/mfa/challenge', cookies, {
      mfaToken,
      code,
    }).expect(401);
    expect(codeOf(reused)).toBe('MFA_CHALLENGE_INVALID');

    // Same code on a new challenge (stolen over the shoulder): replay refused.
    const second = await adminLoginStep();
    const replay = await post('/auth/mfa/challenge', second.jar, {
      mfaToken: second.mfaToken,
      code,
    }).expect(400);
    expect(codeOf(replay)).toBe('MFA_CODE_INVALID');
    await unlock();
  });

  it('kills a challenge after 5 wrong codes, and counts them towards the account lock', async () => {
    const { jar: cookies, mfaToken } = await adminLoginStep();
    for (let i = 0; i < 5; i++) {
      await post('/auth/mfa/challenge', cookies, {
        mfaToken,
        code: '000000',
      }).expect(400);
    }
    const dead = await post('/auth/mfa/challenge', cookies, {
      mfaToken,
      code: await freshCode(prisma, adminId, adminSecret),
    }).expect(401);
    expect(codeOf(dead)).toBe('MFA_CHALLENGE_INVALID');

    // The account is now locked: even the right password is refused.
    const locked = await post('/auth/login', await browser(), {
      email: adminEmail,
      password: ADMIN_PASSWORD,
    }).expect(401);
    expect(codeOf(locked)).toBe('INVALID_CREDENTIALS');
    await unlock();
  });

  it('refuses an expired challenge', async () => {
    const { jar: cookies, mfaToken } = await adminLoginStep();
    await prisma.mfaChallenge.updateMany({
      where: { userId: adminId, consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await post('/auth/mfa/challenge', cookies, {
      mfaToken,
      code: await freshCode(prisma, adminId, adminSecret),
    }).expect(401);
    expect(codeOf(res)).toBe('MFA_CHALLENGE_INVALID');
  });

  it('accepts each recovery code exactly once', async () => {
    const first = await adminLoginStep();
    const code = recoveryCodes[0].toLowerCase().replace('-', ' ');
    first.jar.absorb(
      await post('/auth/mfa/challenge', first.jar, {
        mfaToken: first.mfaToken,
        code,
      }).expect(200),
    );
    jar = first.jar;

    const second = await adminLoginStep();
    await post('/auth/mfa/challenge', second.jar, {
      mfaToken: second.mfaToken,
      code: recoveryCodes[0],
    }).expect(400);
    await unlock();

    const status = await get('/auth/mfa', jar).expect(200);
    expect(body<MfaStatus>(status).data?.recoveryCodesRemaining).toBe(9);
    expect(
      await prisma.auditLog.count({
        where: { action: 'MFA_RECOVERY_CODE_USED', targetId: adminId },
      }),
    ).toBe(1);
  });

  // --- step-up on sensitive actions ------------------------------------------

  it('asks for a code to change the password', async () => {
    const missing = await post('/auth/password/change', jar, {
      currentPassword: ADMIN_PASSWORD,
      newPassword: `${ADMIN_PASSWORD}-v2`,
    }).expect(400);
    expect(codeOf(missing)).toBe('MFA_CODE_REQUIRED');

    const res = await post('/auth/password/change', jar, {
      currentPassword: ADMIN_PASSWORD,
      newPassword: `${ADMIN_PASSWORD}-v2`,
      mfaCode: await freshCode(prisma, adminId, adminSecret),
    }).expect(200);
    jar.absorb(res);
    // Back to the original password for the rest of the suite.
    jar.absorb(
      await post('/auth/password/change', jar, {
        currentPassword: `${ADMIN_PASSWORD}-v2`,
        newPassword: ADMIN_PASSWORD,
        mfaCode: recoveryCodes[1],
      }).expect(200),
    );
  });

  it('regenerates recovery codes only with a valid code, and voids the old ones', async () => {
    await post('/auth/mfa/recovery-codes', jar, { code: '000000' }).expect(400);
    await unlock();

    const res = await post('/auth/mfa/recovery-codes', jar, {
      code: await freshCode(prisma, adminId, adminSecret),
    }).expect(200);
    const fresh = body<RecoveryCodes>(res).data!.recoveryCodes;
    expect(fresh).toHaveLength(10);
    expect(fresh).not.toContain(recoveryCodes[2]);

    const login = await adminLoginStep();
    await post('/auth/mfa/challenge', login.jar, {
      mfaToken: login.mfaToken,
      code: recoveryCodes[2],
    }).expect(400);
    await unlock();
    recoveryCodes = fresh;
  });

  it('replaces a lost phone: the old authenticator works until the new one is confirmed', async () => {
    const missing = await post('/auth/mfa/totp/setup', jar).expect(400);
    expect(codeOf(missing)).toBe('MFA_CODE_REQUIRED');

    // Phone lost: a recovery code authorizes the replacement.
    const started = await post('/auth/mfa/totp/setup', jar, {
      code: recoveryCodes[0],
    }).expect(200);
    const newSecret = base32Decode(body<TotpSetup>(started).data!.secret);

    // Not confirmed yet: the previous authenticator still signs in.
    await webLoginWithMfa(server, prisma, {
      id: adminId,
      email: adminEmail,
      password: ADMIN_PASSWORD,
      secret: adminSecret,
    });

    const confirmed = await post('/auth/mfa/totp/confirm', jar, {
      code: totpAt(newSecret, new Date()),
    }).expect(200);
    recoveryCodes = body<RecoveryCodes>(confirmed).data!.recoveryCodes;

    // From now on only the new one works.
    const old = await adminLoginStep();
    await post('/auth/mfa/challenge', old.jar, {
      mfaToken: old.mfaToken,
      code: await freshCode(prisma, adminId, adminSecret),
    }).expect(400);
    await unlock();
    adminSecret = newSecret;
    await webLoginWithMfa(server, prisma, {
      id: adminId,
      email: adminEmail,
      password: ADMIN_PASSWORD,
      secret: adminSecret,
    });
  });

  // --- admin reset -------------------------------------------------------------

  it('lets another admin reset the authenticator, never their own', async () => {
    const other = await webLoginWithMfa(server, prisma, {
      id: otherAdminId,
      email: otherAdminEmail,
      password: OTHER_ADMIN_PASSWORD,
      secret: otherAdminSecret,
    });

    const self = await post(
      `/admin/users/${otherAdminId}/mfa/reset`,
      other,
    ).expect(422);
    expect(codeOf(self)).toBe('CANNOT_ACT_ON_SELF');

    const res = await post(`/admin/users/${adminId}/mfa/reset`, other).expect(
      200,
    );
    expect(body<{ mfaEnabled: boolean }>(res).data?.mfaEnabled).toBe(false);

    // Every session of the target is gone; next sign-in -> setup again.
    await get('/auth/me', jar).expect(401);
    const cookies = await browser();
    const login = await post('/auth/login', cookies, {
      email: adminEmail,
      password: ADMIN_PASSWORD,
    }).expect(200);
    expect(body<LoginResponse>(login).data).toMatchObject({
      mfaRequired: false,
      accountState: 'MFA_SETUP_REQUIRED',
    });
    expect(
      await prisma.mfaRecoveryCode.count({ where: { userId: adminId } }),
    ).toBe(0);
  });

  // --- optional MFA for drivers (mobile) -------------------------------------

  it('lets a driver enable, use and disable MFA from the mobile app', async () => {
    const signIn = await request(server)
      .post(`${API}/auth/mobile/login`)
      .send({ email: driverEmail, password: DRIVER_PASSWORD })
      .expect(200);
    const token = body<LoginResponse>(signIn).data!.accessToken!;
    const bearer = (method: 'get' | 'post', path: string) =>
      request(server)
        [method](`${API}${path}`)
        .set('Authorization', `Bearer ${token}`);

    const status = await bearer('get', '/auth/mfa').expect(200);
    expect(body<MfaStatus>(status).data).toMatchObject({
      enabled: false,
      required: false,
    });

    const setup = await bearer('post', '/auth/mfa/totp/setup').expect(200);
    const secret = base32Decode(body<TotpSetup>(setup).data!.secret);
    await bearer('post', '/auth/mfa/totp/confirm')
      .send({ code: totpAt(secret, new Date()) })
      .expect(200);

    // Mobile login now needs the second step, on the MOBILE endpoint only.
    const challenged = await request(server)
      .post(`${API}/auth/mobile/login`)
      .send({ email: driverEmail, password: DRIVER_PASSWORD })
      .expect(200);
    const { mfaToken } = body<LoginResponse>(challenged).data!;
    const viaWeb = await post('/auth/mfa/challenge', await browser(), {
      mfaToken,
      code: await freshCode(prisma, driverId, secret),
    }).expect(401);
    expect(codeOf(viaWeb)).toBe('MFA_CHALLENGE_INVALID');

    // The failed web attempt neither consumed the challenge nor the code.
    const done = await request(server)
      .post(`${API}/auth/mobile/mfa/challenge`)
      .send({ mfaToken, code: await freshCode(prisma, driverId, secret) })
      .expect(200);
    expect(body<LoginResponse>(done).data?.accessToken).toMatch(/^eyJ/);

    // Turning it off needs a code.
    await bearer('post', '/auth/mfa/totp/disable')
      .send({ code: '000000' })
      .expect(400);
    await prisma.user.update({
      where: { id: driverId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    const next = hotp(secret, timeStep(new Date()) + 1);
    await bearer('post', '/auth/mfa/totp/disable')
      .send({ code: next })
      .expect(200);
    const after = await request(server)
      .post(`${API}/auth/mobile/login`)
      .send({ email: driverEmail, password: DRIVER_PASSWORD })
      .expect(200);
    expect(body<LoginResponse>(after).data?.mfaRequired).toBe(false);
  });
});
