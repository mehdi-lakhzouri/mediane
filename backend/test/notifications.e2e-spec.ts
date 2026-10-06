import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getStorageToken } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { DeviceHealthMonitor } from '../src/modules/devices/application/device-health.monitor';
import { DevicesService } from '../src/modules/devices/application/devices.service';
import { MailSender } from '../src/modules/mail/application/mail-sender';
import { NotificationRetentionJob } from '../src/modules/notifications/application/notification-retention.job';
import { PasswordHasher } from '../src/modules/security/application/password-hasher';
import type { CookieJar } from './utils/cookie-jar';
import { enrollTotp, webLoginWithMfa } from './utils/mfa';

/**
 * Phase 10 end to end: active devices (list, revoke one, revoke the others)
 * and the in-app notification center fed by security, family, safety and
 * account events, with mute rules that never silence security or emergencies.
 */
const API = '/api/v1';
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Notify-Driver-Passphrase-1';
const NEW_PASSWORD = 'Notify-Driver-Passphrase-2';
const ADMIN_PASSWORD = 'Notify-Admin-Passphrase-3';
const PIXEL = 'CabinGuard/1.0.0 (Android 15; Pixel 8)';
const TABLET = 'CabinGuard/1.0.0 (Android 14; Galaxy Tab S9)';

interface Envelope<T> {
  data: T | null;
  error: { code: string } | null;
}
interface Notification {
  id: string;
  category: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  critical: boolean;
  readAt: string | null;
}
interface Session {
  id: string;
  device: { label: string; app: boolean };
  current: boolean;
}

const dataOf = <T>(res: { body: unknown }) => (res.body as Envelope<T>).data!;
const codeOf = (res: { body: unknown }) =>
  (res.body as Envelope<unknown>).error?.code;

describe('Notifications and devices (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let prisma: PrismaService;
  const stamp = Date.now();
  const createdIds: string[] = [];
  const deviceIds: string[] = [];
  const emails: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let adminJar: CookieJar;

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
        sendFamilyIncidentAlert: () => Promise.resolve(),
        sendFamilyAllClear: () => Promise.resolve(),
      })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    const hash = await app.get(PasswordHasher).hash(PASSWORD);
    for (const name of ['amira', 'bilel']) {
      emails[name] = `notify-${name}-${stamp}@cabinguard.test`;
      const user = await prisma.user.create({
        data: {
          email: emails[name],
          passwordHash: hash,
          role: 'DRIVER',
          status: 'ACTIVE',
          firstName: name[0].toUpperCase() + name.slice(1),
          lastName: 'Driver',
          emailVerifiedAt: new Date(),
          profileCompletedAt: new Date(),
        },
      });
      ids[name] = user.id;
      createdIds.push(user.id);
    }
    const admin = await prisma.user.create({
      data: {
        email: `notify-admin-${stamp}@cabinguard.test`,
        passwordHash: await app.get(PasswordHasher).hash(ADMIN_PASSWORD),
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: 'Notify',
        lastName: 'Admin',
        emailVerifiedAt: new Date(),
      },
    });
    createdIds.push(admin.id);
    adminJar = await webLoginWithMfa(server, prisma, {
      id: admin.id,
      email: admin.email,
      password: ADMIN_PASSWORD,
      secret: await enrollTotp(app, prisma, admin.id),
    });
  });

  afterAll(async () => {
    const families = await prisma.familyMember.findMany({
      where: { userId: { in: createdIds } },
      select: { familyId: true },
    });
    await prisma.family.deleteMany({
      where: { id: { in: families.map((f) => f.familyId) } },
    });
    await prisma.vehicleDevice.deleteMany({ where: { id: { in: deviceIds } } });
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

  async function login(
    name: string,
    userAgent = PIXEL,
    password = PASSWORD,
  ): Promise<string> {
    const res = await request(server)
      .post(`${API}/auth/mobile/login`)
      .set('User-Agent', userAgent)
      .send({ email: emails[name], password })
      .expect(200);
    return dataOf<{ accessToken: string }>(res).accessToken;
  }

  const as = (
    token: string,
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
  ) =>
    request(server)
      [method](`${API}${path}`)
      .set('Authorization', `Bearer ${token}`);

  async function notificationsOf(token: string): Promise<Notification[]> {
    return dataOf<Notification[]>(
      await as(token, 'get', '/notifications?pageSize=50').expect(200),
    );
  }

  const typesOf = async (token: string) =>
    (await notificationsOf(token)).map((n) => n.type);

  // --- active devices --------------------------------------------------------

  describe('active devices', () => {
    it('names devices, marks this one, and tells about a second sign-in', async () => {
      const phone = await login('amira', PIXEL);
      expect(await typesOf(phone)).toEqual([]);

      const tablet = await login('amira', TABLET);
      const sessions = dataOf<Session[]>(
        await as(tablet, 'get', '/auth/sessions').expect(200),
      );
      expect(sessions.map((s) => [s.device.label, s.current]).sort()).toEqual([
        ['Galaxy Tab S9 · Android 14', true],
        ['Pixel 8 · Android 15', false],
      ]);

      const [signIn] = await notificationsOf(phone);
      expect(signIn).toMatchObject({
        category: 'SECURITY',
        type: 'NEW_SIGN_IN',
        link: '/security/devices',
        readAt: null,
      });
      expect(signIn.body).toContain('Galaxy Tab S9 · Android 14');
    });

    it('signs out another device at once, but not this one', async () => {
      const phone = await login('amira', PIXEL);
      const tablet = await login('amira', TABLET);
      const sessions = dataOf<Session[]>(
        await as(tablet, 'get', '/auth/sessions').expect(200),
      );
      const current = sessions.find((s) => s.current)!;
      const phoneSession = dataOf<Session[]>(
        await as(phone, 'get', '/auth/sessions').expect(200),
      ).find((s) => s.current)!;

      const self = await as(
        tablet,
        'delete',
        `/auth/sessions/${current.id}`,
      ).expect(422);
      expect(codeOf(self)).toBe('SESSION_IS_CURRENT');

      await as(tablet, 'delete', `/auth/sessions/${phoneSession.id}`).expect(
        200,
      );
      await as(phone, 'get', '/notifications').expect(401);
      const again = await as(
        tablet,
        'delete',
        `/auth/sessions/${phoneSession.id}`,
      ).expect(404);
      expect(codeOf(again)).toBe('SESSION_NOT_FOUND');
    });

    it('signs out every other device, keeping this one', async () => {
      await login('amira', PIXEL);
      const keep = await login('amira', TABLET);
      const res = await as(keep, 'post', '/auth/sessions/revoke-others').expect(
        200,
      );
      expect(dataOf<{ revoked: number }>(res).revoked).toBeGreaterThanOrEqual(
        1,
      );
      const left = dataOf<Session[]>(
        await as(keep, 'get', '/auth/sessions').expect(200),
      );
      expect(left).toHaveLength(1);
      expect(left[0].current).toBe(true);
    });
  });

  // --- notification center ---------------------------------------------------

  describe('notification center', () => {
    let token: string;

    beforeAll(async () => {
      token = await login('amira', TABLET);
    });

    it('counts, reads one, reads all, and stays private', async () => {
      const unread = dataOf<{ unread: number }>(
        await as(token, 'get', '/notifications/unread-count').expect(200),
      ).unread;
      expect(unread).toBeGreaterThan(0);

      const [first] = await notificationsOf(token);
      await as(token, 'post', `/notifications/${first.id}/read`).expect(200);
      await as(token, 'post', `/notifications/${first.id}/read`).expect(200);
      const reread = (await notificationsOf(token)).find(
        (n) => n.id === first.id,
      )!;
      expect(reread.readAt).not.toBeNull();

      const bilel = await login('bilel');
      await as(bilel, 'post', `/notifications/${first.id}/read`).expect(404);
      await as(
        token,
        'post',
        '/notifications/00000000-0000-7000-8000-000000000000/read',
      ).expect(404);

      await as(token, 'post', '/notifications/read-all').expect(200);
      expect(
        dataOf<{ unread: number }>(
          await as(token, 'get', '/notifications/unread-count').expect(200),
        ).unread,
      ).toBe(0);
      const onlyUnread = dataOf<Notification[]>(
        await as(token, 'get', '/notifications?unreadOnly=true').expect(200),
      );
      expect(onlyUnread).toEqual([]);
    });

    it('validates preferences and reports security as always on', async () => {
      const prefs = dataOf<Record<string, boolean>>(
        await as(token, 'get', '/notification-preferences').expect(200),
      );
      expect(prefs).toEqual({
        safety: true,
        family: true,
        account: true,
        showNamesOnLockScreen: false,
        security: true,
      });
      await as(token, 'put', '/notification-preferences')
        .send({ safety: true, family: false })
        .expect(400);
      await as(token, 'put', '/notification-preferences')
        .send({
          safety: true,
          family: true,
          account: true,
          showNamesOnLockScreen: false,
          security: false,
        })
        .expect(400);
    });
  });

  // --- producers ---------------------------------------------------------------

  describe('family activity, mutes and security', () => {
    it('tells the owner about requests unless family is muted, and the requester about the answer', async () => {
      const owner = await login('amira', TABLET);
      const requester = await login('bilel');
      await as(owner, 'post', '/families').send({ name: `Notify ${stamp}` });
      const invite = dataOf<{ code: string }>(
        await as(owner, 'get', '/families/mine/invite').expect(200),
      );

      // Muted: the request arrives silently.
      await as(owner, 'put', '/notification-preferences')
        .send({
          safety: true,
          family: false,
          account: true,
          showNamesOnLockScreen: false,
        })
        .expect(200);
      await as(requester, 'post', '/families/join')
        .send({ code: invite.code })
        .expect(200);
      expect(await typesOf(owner)).not.toContain('FAMILY_JOIN_REQUESTED');

      // Unmuted: the next request is announced.
      await as(requester, 'delete', '/families/join-request').expect(200);
      await as(owner, 'put', '/notification-preferences')
        .send({
          safety: true,
          family: true,
          account: true,
          showNamesOnLockScreen: true,
        })
        .expect(200);
      await as(requester, 'post', '/families/join')
        .send({ code: invite.code })
        .expect(200);
      const requested = (await notificationsOf(owner)).find(
        (n) => n.type === 'FAMILY_JOIN_REQUESTED',
      );
      expect(requested).toMatchObject({
        body: 'Bilel Driver asked to join your family.',
        link: '/family/requests',
      });

      const [pending] = dataOf<{ id: string }[]>(
        await as(owner, 'get', '/families/mine/join-requests').expect(200),
      );
      await as(
        owner,
        'post',
        `/families/mine/join-requests/${pending.id}/approve`,
      ).expect(200);
      const approved = (await notificationsOf(requester)).find(
        (n) => n.type === 'FAMILY_JOIN_APPROVED',
      );
      expect(approved?.body).toBe(`You are now a member of Notify ${stamp}.`);
    });

    it('never mutes security: a password change is always reported', async () => {
      const token = await login('bilel');
      await as(token, 'put', '/notification-preferences')
        .send({
          safety: false,
          family: false,
          account: false,
          showNamesOnLockScreen: false,
        })
        .expect(200);
      const changed = await as(token, 'post', '/auth/mobile/password/change')
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(200);
      const fresh = dataOf<{ accessToken: string }>(changed).accessToken;
      expect(await typesOf(fresh)).toContain('PASSWORD_CHANGED');
      // Back to defaults for the following tests.
      await as(fresh, 'put', '/notification-preferences')
        .send({
          safety: true,
          family: true,
          account: true,
          showNamesOnLockScreen: false,
        })
        .expect(200);
    });
  });

  describe('account and safety producers', () => {
    it('lets administrators announce to every active driver', async () => {
      const driver = await login('amira', TABLET);
      await as(driver, 'post', '/admin/announcements')
        .send({ title: 'Hi', body: 'There' })
        .expect(403);

      const res = await request(server)
        .post(`${API}/admin/announcements`)
        .set('Cookie', adminJar.header())
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', adminJar.get('cg_csrf') ?? '')
        .send({
          title: 'Maintenance tonight',
          body: 'CabinGuard will be updated at 02:00.',
        })
        .expect(201);
      expect(
        dataOf<{ recipients: number }>(res).recipients,
      ).toBeGreaterThanOrEqual(2);

      const announcement = (await notificationsOf(driver)).find(
        (n) => n.type === 'ANNOUNCEMENT',
      );
      expect(announcement).toMatchObject({
        category: 'ACCOUNT',
        title: 'Maintenance tonight',
        link: null,
      });
    });

    it('reports a silent cabin unit once per silence', async () => {
      const device = await prisma.vehicleDevice.create({
        data: {
          serialNumber: `CG-NOTIFY-${stamp}`,
          label: 'Notify unit',
          secretEnc: 'unused',
          pairedUserId: ids.bilel,
          pairedAt: new Date(),
          lastSeenAt: new Date(Date.now() - 15 * 60_000),
        },
      });
      deviceIds.push(device.id);
      const monitor = app.get(DeviceHealthMonitor);
      const driver = await login('bilel', PIXEL, NEW_PASSWORD);
      const count = async () =>
        (await typesOf(driver)).filter((t) => t === 'CABIN_UNIT_OFFLINE')
          .length;

      await monitor.reportOffline();
      await monitor.reportOffline();
      expect(await count()).toBe(1);

      // Back online, then silent again: reported again.
      await app.get(DevicesService).heartbeat(device.id, undefined);
      await monitor.reportOffline(new Date(Date.now() + 11 * 60_000));
      expect(await count()).toBe(2);
    });

    it('purges notifications older than 90 days', async () => {
      const old = await prisma.userNotification.create({
        data: {
          userId: ids.amira,
          category: 'ACCOUNT',
          type: 'ANNOUNCEMENT',
          title: 'Old',
          body: 'Old news',
          createdAt: new Date(Date.now() - 91 * 86_400_000),
        },
      });
      expect(
        await app.get(NotificationRetentionJob).purge(),
      ).toBeGreaterThanOrEqual(1);
      expect(
        await prisma.userNotification.findUnique({ where: { id: old.id } }),
      ).toBeNull();
    });
  });
});
