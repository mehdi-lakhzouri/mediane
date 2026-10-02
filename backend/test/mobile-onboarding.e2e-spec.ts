import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getStorageToken } from '@nestjs/throttler';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { MailSender } from '../src/modules/mail/application/mail-sender';
import { PasswordHasher } from '../src/modules/security/application/password-hasher';
import { LocalDiskFileStorage } from '../src/modules/storage/infrastructure/local-disk.file-storage';
import { CookieJar } from './utils/cookie-jar';
import { enrollTotp, webLoginWithMfa } from './utils/mfa';

/**
 * Driver onboarding from the mobile app, end to end against PostgreSQL:
 * Bearer sessions -> mandatory password change -> profile -> optional photo.
 * Rate limiting is neutralized (covered in app.e2e-spec.ts).
 */
const API = '/api/v1';
const ORIGIN = 'http://localhost:3000';
const PUBLIC_API = 'http://api.cabinguard.test';
const COOKIE = { access: 'cg_at', refresh: 'cg_rt', csrf: 'cg_csrf' };
const TEMPORARY_PASSWORD = 'Temporary-Driver-Pass-2026!';
const NEW_PASSWORD = 'Driver-Own-Strong-Passphrase-1';
const ADMIN_PASSWORD = 'Admin-Console-Passphrase-4';

interface Envelope<T> {
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: { field?: string; message: string }[];
  } | null;
}
interface MobileSession {
  userId: string;
  role: string;
  accountState: string;
  tokenType: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}
interface Profile {
  phoneNumber: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  emergencyContacts: {
    fullName: string;
    relationship: string;
    phoneNumber: string;
    priority: number;
  }[];
  avatar: { url: string; expiresAt: string } | null;
  completedAt: string | null;
  accountState: string;
}

const body = <T>(res: { body: unknown }) => res.body as Envelope<T>;
const fieldsOf = (res: { body: unknown }) =>
  (body(res).error?.details ?? []).map((d) => d.field);

const VALID_PROFILE = {
  phoneNumber: '+216 12 345 678',
  dateOfBirth: '1990-05-17',
  gender: 'MALE',
  emergencyContacts: [
    {
      fullName: 'Amira Ben Salah',
      relationship: 'SPOUSE',
      phoneNumber: '+21698765432',
    },
    {
      fullName: 'Karim Ben Salah',
      relationship: 'SIBLING',
      phoneNumber: '+216 55-111-222',
    },
  ],
};

describe('Driver onboarding from the mobile app (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let prisma: PrismaService;
  let storage: LocalDiskFileStorage;
  const stamp = Date.now();
  const email = `mobile-${stamp}@cabinguard.test`;
  const adminEmail = `mobile-admin-${stamp}@cabinguard.test`;
  const createdIds: string[] = [];
  let driverId: string;
  let adminId: string;
  let adminSecret: Buffer;
  /** The driver's current session, replaced as the flow moves on. */
  let session: MobileSession;

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
    storage = app.get(LocalDiskFileStorage);

    const hasher = app.get(PasswordHasher);
    // A driver who accepted the invitation: temporary password, no profile.
    const driver = await prisma.user.create({
      data: {
        email,
        passwordHash: await hasher.hash(TEMPORARY_PASSWORD),
        role: 'DRIVER',
        status: 'ACTIVE',
        firstName: 'Mobile',
        lastName: 'Driver',
        mustChangePassword: true,
        temporaryPasswordExpiresAt: new Date(Date.now() + 3600_000),
        emailVerifiedAt: new Date(),
      },
    });
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hasher.hash(ADMIN_PASSWORD),
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: 'Mobile',
        lastName: 'Admin',
        emailVerifiedAt: new Date(),
      },
    });
    driverId = driver.id;
    adminId = admin.id;
    createdIds.push(driver.id, admin.id);
    adminSecret = await enrollTotp(app, prisma, admin.id);
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

  async function mobileLogin(password: string): Promise<MobileSession> {
    const res = await request(server)
      .post(`${API}/auth/mobile/login`)
      .send({ email, password })
      .expect(200);
    return body<MobileSession>(res).data!;
  }

  const authed = (method: 'get' | 'put' | 'post' | 'delete', path: string) =>
    request(server)
      [method](`${API}${path}`)
      .set('Authorization', `Bearer ${session.accessToken}`);

  /** The signed URL is absolute (public base URL); supertest wants the path. */
  const pathOf = (url: string) => url.replace(PUBLIC_API, '');
  const keyOf = (url: string) =>
    new URL(url).pathname.replace(`${API}/files/`, '');
  const diskPathOf = (url: string) =>
    join(process.env.STORAGE_LOCAL_DIR!, ...keyOf(url).split('/'));

  async function photoWithGps(width = 800, height = 600): Promise<Buffer> {
    return sharp({
      create: { width, height, channels: 3, background: '#1d92fa' },
    })
      .jpeg()
      .withExif({
        IFD0: { Make: 'PhoneMaker' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '36/1 48/1 0/1' },
      })
      .toBuffer();
  }

  // --- sessions ------------------------------------------------------------

  it('opens a Bearer session for a driver: tokens in the body, no cookies', async () => {
    const res = await request(server)
      .post(`${API}/auth/mobile/login`)
      .send({ email: email.toUpperCase(), password: TEMPORARY_PASSWORD })
      .expect(200);

    session = body<MobileSession>(res).data!;
    expect(session).toEqual({
      mfaRequired: false,
      userId: driverId,
      role: 'DRIVER',
      accountState: 'PASSWORD_CHANGE_REQUIRED',
      tokenType: 'Bearer',
      accessToken: expect.stringMatching(/^eyJ/),
      accessTokenExpiresAt: expect.any(String),
      refreshToken: expect.any(String),
      refreshTokenExpiresAt: expect.any(String),
    });
    expect(res.get('Set-Cookie')).toBeUndefined();
    const stored = await prisma.refreshSession.findFirstOrThrow({
      where: { userId: driverId, revokedAt: null },
    });
    expect(stored.channel).toBe('MOBILE');
  });

  it('sends administrators to the web console', async () => {
    const res = await request(server)
      .post(`${API}/auth/mobile/login`)
      .send({ email: adminEmail, password: ADMIN_PASSWORD })
      .expect(403);
    expect(body(res).error?.code).toBe('USE_WEB_CONSOLE');
  });

  it('enforces the password change before anything else', async () => {
    const me = await authed('get', '/auth/me').expect(200);
    expect(body<MobileSession>(me).data?.accountState).toBe(
      'PASSWORD_CHANGE_REQUIRED',
    );
    for (const res of [
      await authed('get', '/profile').expect(403),
      await authed('put', '/profile').send(VALID_PROFILE).expect(403),
    ]) {
      expect(body(res).error?.code).toBe('PASSWORD_CHANGE_REQUIRED');
    }
  });

  it('binds each token to its channel', async () => {
    // The mobile access token replayed as a web cookie.
    const asCookie = await request(server)
      .get(`${API}/auth/me`)
      .set('Cookie', `${COOKIE.access}=${session.accessToken}`)
      .expect(401);
    expect(body(asCookie).error?.code).toBe('SESSION_INVALID');

    // The mobile refresh token presented to the web refresh endpoint.
    const jar = new CookieJar().absorb(
      await request(server).get(`${API}/auth/csrf`).expect(200),
    );
    jar.set(COOKIE.refresh, session.refreshToken);
    await request(server)
      .post(`${API}/auth/refresh`)
      .set('Origin', ORIGIN)
      .set('Cookie', jar.header())
      .set('X-CSRF-Token', jar.get(COOKIE.csrf) ?? '')
      .expect(401);

    // Neither attempt consumed nor revoked the mobile session.
    await authed('get', '/auth/me').expect(200);
  });

  it('skips CSRF for Bearer-only requests, never when a session cookie is present', async () => {
    // Passes CSRF, then stops at the onboarding gate.
    const bearerOnly = await authed('put', '/profile')
      .send(VALID_PROFILE)
      .expect(403);
    expect(body(bearerOnly).error?.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const withCookie = await authed('put', '/profile')
      .set('Cookie', `${COOKIE.access}=anything`)
      .send(VALID_PROFILE)
      .expect(403);
    expect(body(withCookie).error?.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('rotates refresh tokens and revokes the session when an old one is replayed', async () => {
    const device = await mobileLogin(TEMPORARY_PASSWORD);

    const refreshed = await request(server)
      .post(`${API}/auth/mobile/refresh`)
      .send({ refreshToken: device.refreshToken })
      .expect(200);
    const rotated = body<MobileSession>(refreshed).data!;
    expect(rotated.refreshToken).not.toBe(device.refreshToken);

    // Concurrent-request race (inside the grace window): refused, session kept.
    await request(server)
      .post(`${API}/auth/mobile/refresh`)
      .send({ refreshToken: device.refreshToken })
      .expect(401);
    await request(server)
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${rotated.accessToken}`)
      .expect(200);

    // Later replay of the stolen token: the whole session dies.
    await prisma.refreshSession.updateMany({
      where: { userId: driverId, revokedAt: null, lastUsedAt: { not: null } },
      data: { lastUsedAt: new Date(Date.now() - 60_000) },
    });
    await request(server)
      .post(`${API}/auth/mobile/refresh`)
      .send({ refreshToken: device.refreshToken })
      .expect(401);
    await request(server)
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${rotated.accessToken}`)
      .expect(401);
    expect(
      await prisma.refreshSession.count({
        where: { userId: driverId, revokedReason: 'TOKEN_REUSE_DETECTED' },
      }),
    ).toBe(1);
    // The first device is unaffected.
    await authed('get', '/auth/me').expect(200);
  });

  // --- mandatory password change -------------------------------------------

  it('changes the temporary password and replaces every session', async () => {
    const otherDevice = await mobileLogin(TEMPORARY_PASSWORD);

    const wrong = await authed('post', '/auth/mobile/password/change')
      .send({ currentPassword: 'not-it', newPassword: NEW_PASSWORD })
      .expect(400);
    expect(body(wrong).error?.code).toBe('INVALID_CURRENT_PASSWORD');

    const weak = await authed('post', '/auth/mobile/password/change')
      .send({ currentPassword: TEMPORARY_PASSWORD, newPassword: 'short' })
      .expect(400);
    expect(body(weak).error?.code).toBe('VALIDATION_FAILED');

    const res = await authed('post', '/auth/mobile/password/change')
      .send({ currentPassword: TEMPORARY_PASSWORD, newPassword: NEW_PASSWORD })
      .expect(200);
    const previous = session;
    session = body<MobileSession>(res).data!;
    expect(session.accountState).toBe('PROFILE_SETUP_REQUIRED');
    expect(session.refreshToken).not.toBe(previous.refreshToken);

    for (const token of [previous.accessToken, otherDevice.accessToken]) {
      await request(server)
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    }
    await request(server)
      .post(`${API}/auth/mobile/login`)
      .send({ email, password: TEMPORARY_PASSWORD })
      .expect(401);

    const current = await prisma.refreshSession.findMany({
      where: { userId: driverId, revokedAt: null },
    });
    expect(current.map((s) => s.channel)).toEqual(['MOBILE']);
  });

  // --- profile ---------------------------------------------------------------

  it('returns an empty profile until it is filled', async () => {
    const res = await authed('get', '/profile').expect(200);
    expect(body<Profile>(res).data).toEqual({
      phoneNumber: null,
      dateOfBirth: null,
      gender: null,
      emergencyContacts: [],
      avatar: null,
      completedAt: null,
      accountState: 'PROFILE_SETUP_REQUIRED',
    });
  });

  it('checks formats field by field', async () => {
    const res = await authed('put', '/profile')
      .send({
        phoneNumber: '0612345678',
        dateOfBirth: '1990-02-30',
        gender: 'OTHER',
        emergencyContacts: [{ fullName: '', relationship: 'BOSS' }],
        bloodType: 'O+',
      })
      .expect(400);
    expect(body(res).error?.code).toBe('VALIDATION_FAILED');
    expect(fieldsOf(res)).toEqual(
      expect.arrayContaining([
        'phoneNumber',
        'dateOfBirth',
        'gender',
        'emergencyContacts.0.fullName',
        'emergencyContacts.0.relationship',
        'emergencyContacts.0.phoneNumber',
        'bloodType',
      ]),
    );

    const noContact = await authed('put', '/profile')
      .send({ ...VALID_PROFILE, emergencyContacts: [] })
      .expect(400);
    expect(fieldsOf(noContact)).toEqual(['emergencyContacts']);
  });

  it('checks business rules: adult driver, distinct contact numbers', async () => {
    const res = await authed('put', '/profile')
      .send({
        ...VALID_PROFILE,
        dateOfBirth: `${new Date().getUTCFullYear() - 17}-01-01`,
        emergencyContacts: [
          {
            fullName: 'Myself',
            relationship: 'OTHER',
            phoneNumber: '+21612345678',
          },
          ...VALID_PROFILE.emergencyContacts,
          {
            fullName: 'Twin',
            relationship: 'SIBLING',
            phoneNumber: '+21698765432',
          },
        ],
      })
      .expect(400);
    expect(body(res).error?.code).toBe('PROFILE_INVALID');
    expect(fieldsOf(res)).toEqual([
      'dateOfBirth',
      'emergencyContacts.0.phoneNumber',
      'emergencyContacts.3.phoneNumber',
    ]);
    expect(
      await prisma.userProfile.count({ where: { userId: driverId } }),
    ).toBe(0);
  });

  it('completes onboarding on the first complete save', async () => {
    const res = await authed('put', '/profile').send(VALID_PROFILE).expect(200);
    const profile = body<Profile>(res).data!;

    expect(profile).toMatchObject({
      phoneNumber: '+21612345678', // spaces removed
      dateOfBirth: '1990-05-17',
      gender: 'MALE',
      accountState: 'ACTIVE',
      avatar: null,
      emergencyContacts: [
        {
          fullName: 'Amira Ben Salah',
          relationship: 'SPOUSE',
          phoneNumber: '+21698765432',
          priority: 1,
        },
        {
          fullName: 'Karim Ben Salah',
          relationship: 'SIBLING',
          phoneNumber: '+21655111222',
          priority: 2,
        },
      ],
    });
    expect(profile.completedAt).not.toBeNull();

    const me = await authed('get', '/auth/me').expect(200);
    expect(body<MobileSession>(me).data?.accountState).toBe('ACTIVE');
    expect(
      await prisma.auditLog.count({
        where: { action: 'PROFILE_COMPLETED', targetId: driverId },
      }),
    ).toBe(1);
  });

  it('keeps the original completion date on later edits', async () => {
    const before = body<Profile>(
      await authed('get', '/profile').expect(200),
    ).data!;
    const reordered = {
      ...VALID_PROFILE,
      emergencyContacts: [...VALID_PROFILE.emergencyContacts].reverse(),
    };
    const res = await authed('put', '/profile').send(reordered).expect(200);
    const after = body<Profile>(res).data!;

    expect(after.completedAt).toBe(before.completedAt);
    expect(
      after.emergencyContacts.map((c) => [c.fullName, c.priority]),
    ).toEqual([
      ['Karim Ben Salah', 1],
      ['Amira Ben Salah', 2],
    ]);
    expect(
      await prisma.auditLog.count({
        where: { action: 'PROFILE_UPDATED', targetId: driverId },
      }),
    ).toBe(1);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'PROFILE_UPDATED', targetId: driverId },
    });
    // Counts only, never the personal data itself.
    expect(audit.metadata).toEqual({ emergencyContacts: 2 });
  });

  // --- avatar ----------------------------------------------------------------

  let firstAvatarUrl: string;

  it('stores the photo re-encoded, without metadata, behind an expiring signed URL', async () => {
    const res = await authed('put', '/profile/avatar')
      .attach('avatar', await photoWithGps(), {
        filename: 'me.jpg',
        contentType: 'image/jpeg',
      })
      .expect(200);
    const avatar = body<Profile>(res).data!.avatar!;
    expect(avatar.url).toMatch(
      new RegExp(
        `^${PUBLIC_API}${API}/files/avatars/[0-9a-f-]{36}\\.webp\\?expires=\\d+&signature=[0-9a-f]{64}$`,
      ),
    );
    expect(new Date(avatar.expiresAt).getTime()).toBeGreaterThan(Date.now());
    firstAvatarUrl = avatar.url;

    const file = await request(server)
      .get(pathOf(avatar.url))
      .buffer(true)
      .parse((r, done) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(file.get('Content-Type')).toBe('image/webp');
    expect(file.get('Cache-Control')).toMatch(/^private, max-age=\d+$/);
    const served = await sharp(file.body as Buffer).metadata();
    expect([served.format, served.width, served.height]).toEqual([
      'webp',
      512,
      512,
    ]);
    expect(served.exif).toBeUndefined();
    expect(existsSync(diskPathOf(avatar.url))).toBe(true);
  });

  it('refuses tampered, expired and malformed download links', async () => {
    const url = new URL(firstAvatarUrl);
    const tampered = `${url.pathname}?expires=${url.searchParams.get('expires')}&signature=${'0'.repeat(64)}`;
    const res = await request(server).get(tampered).expect(404);
    expect(body(res).error?.code).toBe('FILE_NOT_FOUND');

    const expired = await storage.signedDownloadUrl(
      keyOf(firstAvatarUrl),
      60,
      new Date(Date.now() - 120_000),
    );
    await request(server).get(pathOf(expired.url)).expect(404);

    await request(server).get(`${API}/files/avatars`).expect(404);
    await request(server)
      .get(
        `${API}/files/..%2F..%2Fpackage.json/x.webp?expires=9999999999&signature=x`,
      )
      .expect(404);
  });

  it('rejects files that are not usable photos', async () => {
    const fake = await authed('put', '/profile/avatar')
      .attach('avatar', Buffer.from('#!/bin/sh\necho pwned'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
    expect(body(fake).error?.code).toBe('INVALID_IMAGE');

    const missing = await authed('put', '/profile/avatar').expect(400);
    expect(body(missing).error?.code).toBe('INVALID_IMAGE');

    const huge = await authed('put', '/profile/avatar')
      .attach('avatar', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'big.jpg',
        contentType: 'image/jpeg',
      })
      .expect(413);
    expect(body(huge).error?.code).toBe('PAYLOAD_TOO_LARGE');

    // The previous photo is untouched by failed uploads.
    expect(existsSync(diskPathOf(firstAvatarUrl))).toBe(true);
  });

  it('replaces the photo and deletes the previous file', async () => {
    const png = await sharp({
      create: { width: 300, height: 300, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    const res = await authed('put', '/profile/avatar')
      .attach('avatar', png, { filename: 'new.png', contentType: 'image/png' })
      .expect(200);
    const next = body<Profile>(res).data!.avatar!;

    expect(keyOf(next.url)).not.toBe(keyOf(firstAvatarUrl));
    expect(existsSync(diskPathOf(next.url))).toBe(true);
    expect(existsSync(diskPathOf(firstAvatarUrl))).toBe(false);
  });

  it('removes the photo', async () => {
    const current = body<Profile>(await authed('get', '/profile').expect(200))
      .data!.avatar!;
    const res = await authed('delete', '/profile/avatar').expect(200);
    expect(body<Profile>(res).data?.avatar).toBeNull();
    expect(existsSync(diskPathOf(current.url))).toBe(false);
  });

  // --- logout ----------------------------------------------------------------

  it('logs out this device, or every device, without any CSRF token', async () => {
    const other = await mobileLogin(NEW_PASSWORD);
    await authed('post', '/auth/logout-all').expect(200);
    for (const token of [session.accessToken, other.accessToken]) {
      await request(server)
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    }

    session = await mobileLogin(NEW_PASSWORD);
    await request(server)
      .post(`${API}/auth/mobile/logout`)
      .send({ refreshToken: session.refreshToken })
      .expect(200);
    await authed('get', '/auth/me').expect(401);
    await request(server)
      .post(`${API}/auth/mobile/refresh`)
      .send({ refreshToken: session.refreshToken })
      .expect(401);
  });

  // --- account deletion --------------------------------------------------------

  it('deletes the stored photo when an admin permanently deletes the driver', async () => {
    session = await mobileLogin(NEW_PASSWORD);
    const res = await authed('put', '/profile/avatar')
      .attach('avatar', await photoWithGps(), {
        filename: 'me.jpg',
        contentType: 'image/jpeg',
      })
      .expect(200);
    const photoPath = diskPathOf(body<Profile>(res).data!.avatar!.url);
    expect(existsSync(photoPath)).toBe(true);

    const jar = await webLoginWithMfa(server, prisma, {
      id: adminId,
      email: adminEmail,
      password: ADMIN_PASSWORD,
      secret: adminSecret,
    });
    const asAdmin = (method: 'post' | 'delete', path: string) =>
      request(server)
        [method](`${API}${path}`)
        .set('Origin', ORIGIN)
        .set('Cookie', jar.header())
        .set('X-CSRF-Token', jar.get(COOKIE.csrf) ?? '');

    await asAdmin('delete', `/admin/users/${driverId}`).expect(200);
    expect(existsSync(photoPath)).toBe(true); // soft delete keeps it (restorable)
    await asAdmin('post', `/admin/users/${driverId}/hard-delete`)
      .send({ confirmEmail: email })
      .expect(200);
    expect(existsSync(photoPath)).toBe(false);
    expect(await prisma.user.count({ where: { id: driverId } })).toBe(0);
  });
});
