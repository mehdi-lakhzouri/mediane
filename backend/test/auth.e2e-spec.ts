import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getStorageToken } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import {
  MailSender,
  PasswordResetMail,
} from '../src/modules/mail/application/mail-sender';
import { PasswordHasher } from '../src/modules/security/application/password-hasher';
import { CookieJar } from './utils/cookie-jar';

/**
 * Web console authentication flow (cookies + CSRF) against a real PostgreSQL
 * (TEST_DATABASE_URL). Only administrators sign in here; the driver flow over
 * Bearer tokens is covered in mobile-onboarding.e2e-spec.ts.
 * Rate limiting is neutralized here (covered in app.e2e-spec.ts); emails are
 * captured instead of sent.
 */
const ORIGIN = 'http://localhost:3000';
const COOKIE = { access: 'cg_at', refresh: 'cg_rt', csrf: 'cg_csrf' };
const TEMPORARY_PASSWORD = 'Temporary-Pass-2026!';
const NEW_PASSWORD = 'My-Own-Strong-Passphrase-1';
const RESET_PASSWORD = 'Reset-Via-Email-Passphrase-2';
const MOBILE_RESET_PASSWORD = 'Reset-Via-Mobile-Passphrase-3';

interface Envelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}
interface Principal {
  userId: string;
  accountState: string;
  csrfToken?: string;
}

describe('Web console authentication flow (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let prisma: PrismaService;
  const sentResetMails: PasswordResetMail[] = [];
  const email = `e2e-${Date.now()}@cabinguard.test`;
  let userId: string;
  let driverId: string | undefined;

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
        sendPasswordReset: (mail: PasswordResetMail) => {
          sentResetMails.push(mail);
          return Promise.resolve();
        },
      })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    // An invited administrator who accepted the invitation: temporary password.
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await app.get(PasswordHasher).hash(TEMPORARY_PASSWORD),
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: 'E2E',
        lastName: 'Admin',
        mustChangePassword: true,
        temporaryPasswordExpiresAt: new Date(Date.now() + 3600_000),
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    for (const id of [userId, driverId]) {
      if (!id) continue;
      await prisma.auditLog.deleteMany({
        where: { OR: [{ targetId: id }, { actorUserId: id }] },
      });
      await prisma.user.delete({ where: { id } });
    }
    await app.close();
  });

  async function newBrowser(): Promise<CookieJar> {
    const jar = new CookieJar();
    const res = await request(server).get('/api/v1/auth/csrf').expect(200);
    return jar.absorb(res);
  }

  function post(path: string, jar: CookieJar, body: object = {}) {
    return request(server)
      .post(`/api/v1${path}`)
      .set('Origin', ORIGIN)
      .set('Cookie', jar.header())
      .set('X-CSRF-Token', jar.get(COOKIE.csrf) ?? '')
      .send(body);
  }

  function get(path: string, jar: CookieJar) {
    return request(server).get(`/api/v1${path}`).set('Cookie', jar.header());
  }

  async function login(password: string): Promise<CookieJar> {
    const jar = await newBrowser();
    const res = await post('/auth/login', jar, { email, password }).expect(200);
    return jar.absorb(res);
  }

  it('answers the same generic error for a wrong password and an unknown email', async () => {
    const jar = await newBrowser();
    const wrong = await post('/auth/login', jar, {
      email,
      password: 'not-the-password',
    }).expect(401);
    const unknown = await post('/auth/login', jar, {
      email: 'nobody@cabinguard.test',
      password: 'not-the-password',
    }).expect(401);
    expect((wrong.body as Envelope<null>).error).toEqual(
      (unknown.body as Envelope<null>).error,
    );
    expect((wrong.body as Envelope<null>).error?.code).toBe(
      'INVALID_CREDENTIALS',
    );
  });

  it('logs in with the temporary password using HttpOnly cookies only', async () => {
    const jar = await newBrowser();
    const oldCsrf = jar.get(COOKIE.csrf);
    const res = await post('/auth/login', jar, {
      email: email.toUpperCase(),
      password: TEMPORARY_PASSWORD,
      rememberMe: false,
    }).expect(200);

    const body = res.body as Envelope<Principal>;
    expect(body.data).toEqual({
      mfaRequired: false,
      userId,
      role: 'ADMIN',
      accountState: 'PASSWORD_CHANGE_REQUIRED',
      csrfToken: expect.any(String),
    });
    expect(JSON.stringify(body)).not.toMatch(/eyJ/); // no JWT in the body

    const setCookies = res.get('Set-Cookie') ?? [];
    const access = setCookies.find((c) => c.startsWith(`${COOKIE.access}=`));
    const refresh = setCookies.find((c) => c.startsWith(`${COOKIE.refresh}=`));
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/SameSite=Strict/);
    expect(refresh).toMatch(/HttpOnly/);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
    // rememberMe=false => browser-session cookies
    expect(refresh).not.toMatch(/Expires=/);

    jar.absorb(res);
    expect(jar.get(COOKIE.csrf)).toBe(body.data?.csrfToken);
    expect(jar.get(COOKIE.csrf)).not.toBe(oldCsrf);
  });

  it('sends drivers to the mobile app, without opening a web session', async () => {
    const password = 'Driver-Own-Passphrase-9';
    const driver = await prisma.user.create({
      data: {
        email: `e2e-driver-${Date.now()}@cabinguard.test`,
        passwordHash: await app.get(PasswordHasher).hash(password),
        role: 'DRIVER',
        status: 'ACTIVE',
        firstName: 'E2E',
        lastName: 'Driver',
        emailVerifiedAt: new Date(),
        profileCompletedAt: new Date(),
      },
    });
    driverId = driver.id;

    const jar = await newBrowser();
    const res = await post('/auth/login', jar, {
      email: driver.email,
      password,
    }).expect(403);
    expect((res.body as Envelope<null>).error?.code).toBe('USE_MOBILE_APP');
    const setCookies = res.get('Set-Cookie') ?? [];
    expect(setCookies.some((c) => c.startsWith(`${COOKIE.access}=`))).toBe(
      false,
    );
    expect(
      await prisma.refreshSession.count({ where: { userId: driver.id } }),
    ).toBe(0);

    // Without the right password, the answer stays the generic one.
    const wrong = await post('/auth/login', jar, {
      email: driver.email,
      password: 'not-the-password',
    }).expect(401);
    expect((wrong.body as Envelope<null>).error?.code).toBe(
      'INVALID_CREDENTIALS',
    );
  });

  it('enforces the mandatory password change server-side', async () => {
    const jar = await login(TEMPORARY_PASSWORD);
    const me = await get('/auth/me', jar).expect(200);
    expect((me.body as Envelope<Principal>).data?.accountState).toBe(
      'PASSWORD_CHANGE_REQUIRED',
    );
    const users = await get('/admin/users', jar).expect(403);
    expect((users.body as Envelope<null>).error?.code).toBe(
      'PASSWORD_CHANGE_REQUIRED',
    );
  });

  it('rotates the refresh token and tolerates a concurrent-tab replay', async () => {
    const jar = await login(TEMPORARY_PASSWORD);
    const stolen = jar.clone();

    const refreshed = await post('/auth/refresh', jar).expect(200);
    jar.absorb(refreshed);
    expect(jar.get(COOKIE.refresh)).not.toBe(stolen.get(COOKIE.refresh));

    // Replay right away (grace window): rejected, but the session survives.
    const replay = stolen.clone().set(COOKIE.csrf, jar.get(COOKIE.csrf) ?? '');
    await post('/auth/refresh', replay).expect(401);
    await get('/auth/me', jar).expect(200);
  });

  it('revokes the whole session when a rotated token is replayed later', async () => {
    const jar = await login(TEMPORARY_PASSWORD);
    const stolen = jar.clone();
    jar.absorb(await post('/auth/refresh', jar).expect(200));

    // Move the last rotation outside the grace window.
    await prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { lastUsedAt: new Date(Date.now() - 60_000) },
    });

    const replay = stolen.clone().set(COOKIE.csrf, jar.get(COOKIE.csrf) ?? '');
    await post('/auth/refresh', replay).expect(401);

    const me = await get('/auth/me', jar).expect(401);
    expect((me.body as Envelope<null>).error?.code).toBe('SESSION_INVALID');
    const revoked = await prisma.refreshSession.count({
      where: { userId, revokedReason: 'TOKEN_REUSE_DETECTED' },
    });
    expect(revoked).toBe(1);
  });

  it('logs out one device and clears its cookies', async () => {
    const deviceA = await login(TEMPORARY_PASSWORD);
    const deviceB = await login(TEMPORARY_PASSWORD);
    const refreshA = deviceA.clone();

    const res = await post('/auth/logout', deviceA).expect(200);
    deviceA.absorb(res);
    expect(deviceA.get(COOKIE.access)).toBeUndefined();
    expect(deviceA.get(COOKIE.refresh)).toBeUndefined();

    await post('/auth/refresh', refreshA).expect(401);
    await get('/auth/me', deviceB).expect(200);
  });

  it('changes the temporary password and replaces every session', async () => {
    const current = await login(TEMPORARY_PASSWORD);
    const other = await login(TEMPORARY_PASSWORD);

    const weak = await post('/auth/password/change', current, {
      currentPassword: TEMPORARY_PASSWORD,
      newPassword: `${email.split('@')[0]}-Passphrase`,
    }).expect(400);
    expect((weak.body as Envelope<null>).error?.code).toBe('WEAK_PASSWORD');

    const wrongCurrent = await post('/auth/password/change', current, {
      currentPassword: 'wrong-current-password',
      newPassword: NEW_PASSWORD,
    }).expect(400);
    expect((wrongCurrent.body as Envelope<null>).error?.code).toBe(
      'INVALID_CURRENT_PASSWORD',
    );

    const res = await post('/auth/password/change', current, {
      currentPassword: TEMPORARY_PASSWORD,
      newPassword: NEW_PASSWORD,
    }).expect(200);
    current.absorb(res);
    // Next onboarding step for administrators: the authenticator (no profile).
    expect((res.body as Envelope<Principal>).data?.accountState).toBe(
      'MFA_SETUP_REQUIRED',
    );

    const me = await get('/auth/me', current).expect(200);
    expect((me.body as Envelope<Principal>).data?.accountState).toBe(
      'MFA_SETUP_REQUIRED',
    );
    const console = await get('/admin/users', current).expect(403);
    expect((console.body as Envelope<null>).error?.code).toBe(
      'MFA_SETUP_REQUIRED',
    );
    await get('/auth/me', other).expect(401);

    const oldPassword = await newBrowser();
    await post('/auth/login', oldPassword, {
      email,
      password: TEMPORARY_PASSWORD,
    }).expect(401);
  });

  it('resets a forgotten password with a single-use emailed token', async () => {
    const session = await login(NEW_PASSWORD);
    const anonymous = await newBrowser();

    const unknown = await post('/auth/password/forgot', anonymous, {
      email: 'nobody@cabinguard.test',
    }).expect(202);
    const known = await post('/auth/password/forgot', anonymous, {
      email,
    }).expect(202);
    expect(unknown.body).toMatchObject({ data: null, error: null });
    expect(known.body).toMatchObject({ data: null, error: null });

    // Mail is sent after commit, without being awaited by the request.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sentResetMails).toHaveLength(1);
    const token = new URL(sentResetMails[0].resetUrl).hash.replace(
      '#token=',
      '',
    );
    expect(sentResetMails[0].resetUrl).not.toContain('?');

    await post('/auth/password/reset', anonymous, {
      token,
      newPassword: RESET_PASSWORD,
    }).expect(200);

    const replay = await post('/auth/password/reset', anonymous, {
      token,
      newPassword: 'Another-Reset-Passphrase-3',
    }).expect(422);
    expect((replay.body as Envelope<null>).error?.code).toBe(
      'PASSWORD_RESET_TOKEN_INVALID',
    );

    await get('/auth/me', session).expect(401); // sessions revoked by the reset
    await login(RESET_PASSWORD);
  });

  it('exposes password recovery to native clients without cookies or CSRF', async () => {
    const before = sentResetMails.length;
    const forgot = await request(server)
      .post('/api/v1/auth/mobile/password/forgot')
      .send({ email })
      .expect(202);
    expect(forgot.get('Set-Cookie')).toBeUndefined();
    expect(forgot.body).toMatchObject({ data: null, error: null });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sentResetMails).toHaveLength(before + 1);
    const resetUrl = new URL(sentResetMails.at(-1)!.resetUrl);
    const token = resetUrl.hash.replace('#token=', '');

    const validation = await request(server)
      .post('/api/v1/auth/mobile/password/validate')
      .send({ token })
      .expect(200);
    expect(validation.body).toMatchObject({
      data: { expiresAt: expect.any(String) },
      error: null,
    });

    await request(server)
      .post('/api/v1/auth/mobile/password/reset')
      .send({ token, newPassword: MOBILE_RESET_PASSWORD })
      .expect(200);

    const consumed = await request(server)
      .post('/api/v1/auth/mobile/password/validate')
      .send({ token })
      .expect(422);
    expect((consumed.body as Envelope<null>).error?.code).toBe(
      'PASSWORD_RESET_TOKEN_INVALID',
    );
    await login(MOBILE_RESET_PASSWORD);
  });
});
