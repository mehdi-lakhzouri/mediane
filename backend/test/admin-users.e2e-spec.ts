import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getStorageToken } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import {
  InvitationMail,
  MailSender,
} from '../src/modules/mail/application/mail-sender';
import { PasswordHasher } from '../src/modules/security/application/password-hasher';
import { CookieJar } from './utils/cookie-jar';
import { enrollTotp, webLoginWithMfa } from './utils/mfa';

const ORIGIN = 'http://localhost:3000';
const COOKIE = { csrf: 'cg_csrf' };
const ADMIN_PASSWORD = 'Admin-Console-Passphrase-9';

interface Envelope<T> {
  data: T | null;
  meta: { pagination?: { totalItems: number } };
  error: { code: string; message: string } | null;
}
interface UserView {
  id: string;
  email: string;
  firstName: string;
  status: string;
  accountState: string;
  deletedAt: string | null;
}

describe('Admin user management (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let prisma: PrismaService;
  const sentInvites: InvitationMail[] = [];
  const stamp = Date.now();
  const adminEmail = `admin-${stamp}@cabinguard.test`;
  const driverEmail = `driver-${stamp}@cabinguard.test`;
  let adminId = '';
  let jar: CookieJar;
  const createdIds: string[] = [];

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
        sendInvitation: (mail: InvitationMail) => {
          sentInvites.push(mail);
          return Promise.resolve();
        },
        sendInvitationResend: (mail: InvitationMail) => {
          sentInvites.push(mail);
          return Promise.resolve();
        },
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

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await app.get(PasswordHasher).hash(ADMIN_PASSWORD),
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: 'Ada',
        lastName: 'Admin',
        emailVerifiedAt: new Date(),
        profileCompletedAt: new Date(),
      },
    });
    adminId = admin.id;
    createdIds.push(admin.id);

    // Administrators cannot use the console without a second factor.
    const secret = await enrollTotp(app, prisma, admin.id);
    jar = await webLoginWithMfa(server, prisma, {
      id: admin.id,
      email: adminEmail,
      password: ADMIN_PASSWORD,
      secret,
    });
  });

  afterAll(async () => {
    const ids = [...new Set(createdIds)];
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ targetId: { in: ids } }, { actorUserId: { in: ids } }],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  function post(path: string, body: object = {}) {
    return request(server)
      .post(`/api/v1${path}`)
      .set('Origin', ORIGIN)
      .set('Cookie', jar.header())
      .set('X-CSRF-Token', jar.get(COOKIE.csrf) ?? '')
      .send(body);
  }

  function patch(path: string, body: object) {
    return request(server)
      .patch(`/api/v1${path}`)
      .set('Origin', ORIGIN)
      .set('Cookie', jar.header())
      .set('X-CSRF-Token', jar.get(COOKIE.csrf) ?? '')
      .send(body);
  }

  function del(path: string) {
    return request(server)
      .delete(`/api/v1${path}`)
      .set('Origin', ORIGIN)
      .set('Cookie', jar.header())
      .set('X-CSRF-Token', jar.get(COOKIE.csrf) ?? '');
  }

  const get = (path: string) =>
    request(server).get(`/api/v1${path}`).set('Cookie', jar.header());

  const body = <T>(res: { body: unknown }) => res.body as Envelope<T>;

  let driverId = '';

  it('creates a driver, stores no secret in clear and emails the invitation', async () => {
    const res = await post('/admin/users', {
      email: driverEmail.toUpperCase(),
      firstName: 'Dana',
      lastName: 'Driver',
      role: 'DRIVER',
    }).expect(201);

    const view = body<UserView>(res).data;
    expect(view).toMatchObject({
      email: driverEmail,
      firstName: 'Dana',
      status: 'INVITED',
      accountState: 'INVITED',
    });
    driverId = view!.id;
    createdIds.push(driverId);

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: driverId },
    });
    expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(row.mustChangePassword).toBe(true);
    expect(row.temporaryPasswordExpiresAt).not.toBeNull();

    const invitation = await prisma.invitation.findFirstOrThrow({
      where: { userId: driverId },
    });
    expect(invitation.status).toBe('PENDING');
    expect(invitation.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    expect(sentInvites).toHaveLength(1);
    const mail = sentInvites[0];
    // The raw token travels in the URL fragment, never the query string.
    expect(mail.acceptUrl).toContain('#token=');
    expect(mail.acceptUrl).not.toContain('?');
    expect(invitation.tokenHash).not.toContain(
      mail.acceptUrl.split('#token=')[1],
    );
    expect(row.passwordHash).not.toContain(mail.temporaryPassword);
  });

  it('rejects a duplicate email', async () => {
    const res = await post('/admin/users', {
      email: driverEmail,
      firstName: 'Dup',
      lastName: 'Licate',
      role: 'DRIVER',
    }).expect(409);
    expect(body(res).error?.code).toBe('EMAIL_ALREADY_IN_USE');
  });

  it('lists, searches and paginates', async () => {
    const all = await get('/admin/users?page=1&pageSize=5').expect(200);
    expect(body<UserView[]>(all).meta.pagination?.totalItems).toBeGreaterThan(
      0,
    );

    const found = await get(
      `/admin/users?search=${encodeURIComponent(driverEmail)}`,
    ).expect(200);
    const items = body<UserView[]>(found).data ?? [];
    expect(items).toHaveLength(1);
    expect(items[0].email).toBe(driverEmail);

    const filtered = await get('/admin/users?role=ADMIN&status=ACTIVE').expect(
      200,
    );
    expect(
      (body<UserView[]>(filtered).data ?? []).every(
        (u) => u.email !== driverEmail,
      ),
    ).toBe(true);
  });

  it('updates identity fields', async () => {
    const res = await patch(`/admin/users/${driverId}`, {
      firstName: 'Danielle',
    }).expect(200);
    expect(body<UserView>(res).data?.firstName).toBe('Danielle');
  });

  it('suspends and reactivates', async () => {
    const suspended = await post(`/admin/users/${driverId}/suspend`).expect(
      200,
    );
    expect(body<UserView>(suspended).data?.status).toBe('SUSPENDED');

    await post(`/admin/users/${driverId}/suspend`).expect(422);

    const back = await post(`/admin/users/${driverId}/reactivate`).expect(200);
    expect(body<UserView>(back).data?.status).toBe('ACTIVE');
  });

  it('refuses to let an admin suspend or delete themselves', async () => {
    const suspend = await post(`/admin/users/${adminId}/suspend`).expect(422);
    expect(body(suspend).error?.code).toBe('CANNOT_ACT_ON_SELF');
    const remove = await del(`/admin/users/${adminId}`).expect(422);
    expect(body(remove).error?.code).toBe('CANNOT_ACT_ON_SELF');
  });

  it('soft deletes, hides from the default list, then restores', async () => {
    await del(`/admin/users/${driverId}`).expect(200);

    const hidden = await get(
      `/admin/users?search=${encodeURIComponent(driverEmail)}`,
    ).expect(200);
    expect(body<UserView[]>(hidden).data).toHaveLength(0);

    const shown = await get(
      `/admin/users?includeDeleted=true&search=${encodeURIComponent(driverEmail)}`,
    ).expect(200);
    expect(body<UserView[]>(shown).data?.[0].accountState).toBe('DELETED');

    const deletedOnly = await get(
      `/admin/users?onlyDeleted=true&search=${encodeURIComponent(driverEmail)}`,
    ).expect(200);
    expect(body<UserView[]>(deletedOnly).data).toHaveLength(1);

    const activeOnly = await get(
      `/admin/users?onlyDeleted=true&search=${encodeURIComponent(adminEmail)}`,
    ).expect(200);
    expect(body<UserView[]>(activeOnly).data).toHaveLength(0);

    const restored = await post(`/admin/users/${driverId}/restore`).expect(200);
    expect(body<UserView>(restored).data?.deletedAt).toBeNull();
  });

  it('hard deletes only a soft-deleted account, with a matching confirmation', async () => {
    await post(`/admin/users/${driverId}/hard-delete`, {
      confirmEmail: driverEmail,
    }).expect(422);

    const profile = await prisma.userProfile.create({
      data: {
        userId: driverId,
        phoneNumber: '+2348012345678',
        emergencyContacts: {
          create: {
            fullName: 'Emergency Contact',
            relationship: 'FRIEND',
            phoneNumber: '+2348087654321',
            priority: 1,
          },
        },
      },
    });
    await prisma.refreshSession.create({
      data: {
        userId: driverId,
        tokenHash: driverId.replaceAll('-', '').padEnd(64, 'a'),
        expiresAt: new Date(Date.now() + 60_000),
        absoluteExpiresAt: new Date(Date.now() + 120_000),
      },
    });
    await prisma.userMfa.create({ data: { userId: driverId } });
    await prisma.mfaRecoveryCode.create({
      data: {
        userId: driverId,
        codeHash: driverId.replaceAll('-', '').padEnd(64, 'b'),
      },
    });
    await prisma.userNotification.create({
      data: {
        userId: driverId,
        category: 'ACCOUNT',
        type: 'ACCOUNT_TEST',
        title: 'Account notice',
        body: 'Cascade verification',
      },
    });
    await prisma.notificationPreference.create({
      data: { userId: driverId },
    });
    const incident = await prisma.incident.create({
      data: {
        userId: driverId,
        status: 'AWAITING_RESPONSE',
        severity: 'CRITICAL',
        triggerType: 'SOS',
      },
    });
    await prisma.medicalEvent.create({
      data: {
        userId: driverId,
        incidentId: incident.id,
        source: 'DRIVER',
        type: 'SOS',
        severity: 'CRITICAL',
        clientEventId: `cascade-${stamp}`,
        detectedAt: new Date(),
      },
    });
    const device = await prisma.vehicleDevice.create({
      data: {
        serialNumber: `CASCADE-${stamp}`,
        label: 'Cascade verification unit',
        secretEnc: 'test-only-encrypted-secret',
        pairedUserId: driverId,
      },
    });

    await del(`/admin/users/${driverId}`).expect(200);

    const mismatch = await post(`/admin/users/${driverId}/hard-delete`, {
      confirmEmail: 'someone-else@cabinguard.test',
    }).expect(400);
    expect(mismatch.body).toMatchObject({
      error: { code: 'CONFIRMATION_MISMATCH' },
    });

    await post(`/admin/users/${driverId}/hard-delete`, {
      confirmEmail: driverEmail,
    }).expect(200);

    expect(
      await prisma.user.findUnique({ where: { id: driverId } }),
    ).toBeNull();
    expect(
      await Promise.all([
        prisma.userProfile.count({ where: { userId: driverId } }),
        prisma.emergencyContact.count({ where: { profileId: profile.id } }),
        prisma.invitation.count({ where: { userId: driverId } }),
        prisma.refreshSession.count({ where: { userId: driverId } }),
        prisma.userMfa.count({ where: { userId: driverId } }),
        prisma.mfaRecoveryCode.count({ where: { userId: driverId } }),
        prisma.userNotification.count({ where: { userId: driverId } }),
        prisma.notificationPreference.count({ where: { userId: driverId } }),
        prisma.medicalEvent.count({ where: { userId: driverId } }),
        prisma.incident.count({ where: { userId: driverId } }),
      ]),
    ).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(
      await prisma.vehicleDevice.findUnique({ where: { id: device.id } }),
    ).toMatchObject({ pairedUserId: null });
    // The audit trail outlives the row it describes.
    expect(
      await prisma.auditLog.count({
        where: { targetId: driverId, action: 'USER_HARD_DELETED' },
      }),
    ).toBe(1);
    await prisma.vehicleDevice.delete({ where: { id: device.id } });
  });

  it('lets the mobile app accept an invitation without cookies or CSRF', async () => {
    const email = `mobile-invitee-${stamp}@cabinguard.test`;
    const created = await post('/admin/users', {
      email,
      firstName: 'Mona',
      lastName: 'Mobile',
      role: 'DRIVER',
    }).expect(201);
    const inviteeId = body<UserView>(created).data!.id;
    createdIds.push(inviteeId);

    const mail = sentInvites.at(-1)!;
    const token = mail.acceptUrl.split('#token=')[1];
    const accept = () =>
      request(server).post('/api/v1/invitations/mobile/accept').send({ token });

    const accepted = await accept().expect(200);
    expect(accepted.get('Set-Cookie')).toBeUndefined();
    expect(accepted.body).toMatchObject({ data: null, error: null });

    const replay = await accept().expect(422);
    expect(body(replay).error?.code).toBe('INVITATION_INVALID');

    const signIn = await request(server)
      .post('/api/v1/auth/mobile/login')
      .send({ email, password: mail.temporaryPassword })
      .expect(200);
    expect(body<UserView>(signIn).data).toMatchObject({
      accountState: 'PASSWORD_CHANGE_REQUIRED',
    });
  });

  it('lets the invited driver accept once, then sign in with the temporary password', async () => {
    const email = `invitee-${stamp}@cabinguard.test`;
    const created = await post('/admin/users', {
      email,
      firstName: 'Ivy',
      lastName: 'Invitee',
      role: 'DRIVER',
    }).expect(201);
    const inviteeId = body<UserView>(created).data!.id;
    createdIds.push(inviteeId);

    const mail = sentInvites.at(-1)!;
    const token = mail.acceptUrl.split('#token=')[1];
    const anon = new CookieJar();
    anon.absorb(await request(server).get('/api/v1/auth/csrf').expect(200));

    const acceptWith = (jar: CookieJar, value: string) =>
      request(server)
        .post('/api/v1/invitations/accept')
        .set('Origin', ORIGIN)
        .set('Cookie', jar.header())
        .set('X-CSRF-Token', jar.get(COOKIE.csrf) ?? '')
        .send({ token: value });

    await acceptWith(anon, token).expect(200);

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: inviteeId },
    });
    expect(row.status).toBe('ACTIVE');
    expect(row.emailVerifiedAt).not.toBeNull();
    // Accepting proves the address; it does not clear the forced change.
    expect(row.mustChangePassword).toBe(true);

    // Replaying the same link is refused, with no hint about why.
    const replay = await acceptWith(anon, token).expect(422);
    expect(body(replay).error?.code).toBe('INVITATION_INVALID');

    const unknown = await acceptWith(anon, 'a'.repeat(43)).expect(422);
    expect(body(unknown).error).toEqual(body(replay).error);

    // The link alone grants nothing: the temporary password still gates
    // sign-in, in the mobile app (drivers do not use the web console).
    const signIn = await request(server)
      .post('/api/v1/auth/mobile/login')
      .send({ email, password: mail.temporaryPassword })
      .expect(200);
    expect(body<UserView>(signIn).data).toMatchObject({
      accountState: 'PASSWORD_CHANGE_REQUIRED',
    });
  });

  it('keeps the whole area closed to drivers', async () => {
    const password = 'Driver-Own-Passphrase-7';
    const driver = await prisma.user.create({
      data: {
        email: `plain-${stamp}@cabinguard.test`,
        passwordHash: await app.get(PasswordHasher).hash(password),
        role: 'DRIVER',
        status: 'ACTIVE',
        firstName: 'Plain',
        lastName: 'Driver',
        emailVerifiedAt: new Date(),
        profileCompletedAt: new Date(),
      },
    });
    createdIds.push(driver.id);

    const signIn = await request(server)
      .post('/api/v1/auth/mobile/login')
      .send({ email: driver.email, password })
      .expect(200);
    const { accessToken } = body<{ accessToken: string }>(signIn).data ?? {};

    const res = await request(server)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
    expect(body(res).error?.code).toBe('FORBIDDEN');
  });
});
