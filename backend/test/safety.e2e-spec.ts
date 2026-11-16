import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getStorageToken } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import type { FamilyIncidentMail } from '../src/modules/mail/application/mail-sender';
import { MailSender } from '../src/modules/mail/application/mail-sender';
import { EscalationService } from '../src/modules/safety/application/escalation.service';
import { SafetyRetentionService } from '../src/modules/safety/application/safety-retention.service';
import { PasswordHasher } from '../src/modules/security/application/password-hasher';
import type { CookieJar } from './utils/cookie-jar';
import { deviceRequest, type TestUnit } from './utils/device-signing';
import { enrollTotp, webLoginWithMfa } from './utils/mfa';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { rm } from 'node:fs/promises';
import { AI_MODEL_HASHES } from '../src/modules/safety/domain/ai-model-manifest';

/**
 * In-cabin units and emergency response end to end against PostgreSQL:
 * administrator device lifecycle, signed device requests (replay, tamper,
 * rotation, revocation), event ingestion, countdown and escalation,
 * notifications, "I'm OK" from app and cabin, SOS, family visibility,
 * auto-close and retention. The worker is off in tests: time-driven steps
 * run through EscalationService with an explicit clock.
 */
const API = '/api/v1';
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Safety-Driver-Passphrase-1';
const ADMIN_PASSWORD = 'Safety-Admin-Passphrase-2';

interface Envelope<T> {
  data: T | null;
  meta: { totalItems?: number } | null;
  error: { code: string } | null;
}
interface Device {
  id: string;
  serialNumber: string;
  status: string;
  pairedUserId: string | null;
  pairedDriver: { firstName: string } | null;
  lastSeenAt: string | null;
}
interface Receipt {
  eventId: string;
  incidentId: string | null;
  incidentStatus: string | null;
  respondBy: string | null;
  duplicate: boolean;
}
interface Incident {
  id: string;
  status: string;
  severity: string;
  triggerType: string;
  respondBy: string | null;
  escalatedAt: string | null;
  resolvedVia: string | null;
  location: { latitude: number; longitude: number } | null;
}
interface IncidentDetail {
  serverTime: string;
  incident: Incident;
  events: { id: string; type: string }[];
  timeline: { kind: string }[];
  notifications: {
    kind: string;
    recipientType: string;
    recipientName: string;
    channel: string;
    status: string;
  }[];
}

const body = <T>(res: { body: unknown }) => res.body as Envelope<T>;
const dataOf = <T>(res: { body: unknown }) => body<T>(res).data!;
const codeOf = (res: { body: unknown }) => body(res).error?.code;

describe('Safety (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let prisma: PrismaService;
  let escalation: EscalationService;
  const stamp = Date.now();
  const createdIds: string[] = [];
  const deviceIds: string[] = [];
  const drivers: Record<string, { id: string; token: string }> = {};
  let adminJar: CookieJar;
  let adminId: string;
  let unit: TestUnit & { id: string };
  const alerts: FamilyIncidentMail[] = [];
  const allClears: FamilyIncidentMail[] = [];

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
        sendFamilyIncidentAlert: (mail: FamilyIncidentMail) => {
          alerts.push(mail);
          return Promise.resolve();
        },
        sendFamilyAllClear: (mail: FamilyIncidentMail) => {
          allClears.push(mail);
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
    escalation = app.get(EscalationService);

    const hash = await app.get(PasswordHasher).hash(PASSWORD);
    for (const name of ['amira', 'bilel', 'chaima', 'ai']) {
      const user = await prisma.user.create({
        data: {
          email: `safety-${name}-${stamp}@cabinguard.test`,
          passwordHash: hash,
          role: 'DRIVER',
          status: 'ACTIVE',
          firstName: name[0].toUpperCase() + name.slice(1),
          lastName: 'Driver',
          emailVerifiedAt: new Date(),
          profileCompletedAt: new Date(),
        },
      });
      createdIds.push(user.id);
      const login = await request(server)
        .post(`${API}/auth/mobile/login`)
        .send({ email: user.email, password: PASSWORD })
        .expect(200);
      drivers[name] = {
        id: user.id,
        token: dataOf<{ accessToken: string }>(login).accessToken,
      };
    }

    // Amira: two emergency contacts, shares incidents with Bilel's family.
    await prisma.userProfile.create({
      data: {
        userId: drivers.amira.id,
        phoneNumber: '+21655000001',
        dateOfBirth: new Date('1988-04-12'),
        gender: 'FEMALE',
        emergencyContacts: {
          create: [
            {
              fullName: 'Sami Contact',
              relationship: 'SPOUSE',
              phoneNumber: '+21698000001',
              priority: 1,
            },
            {
              fullName: 'Lina Contact',
              relationship: 'SIBLING',
              phoneNumber: '+21698000002',
              priority: 2,
            },
          ],
        },
      },
    });
    await prisma.family.create({
      data: {
        name: `Safety family ${stamp}`,
        members: {
          create: [
            {
              userId: drivers.amira.id,
              role: 'OWNER',
              shareIncidents: true,
              shareIncidentsAt: new Date(),
            },
            { userId: drivers.bilel.id, role: 'MEMBER' },
          ],
        },
      },
    });

    const admin = await prisma.user.create({
      data: {
        email: `safety-admin-${stamp}@cabinguard.test`,
        passwordHash: await app.get(PasswordHasher).hash(ADMIN_PASSWORD),
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: 'Safety',
        lastName: 'Admin',
        emailVerifiedAt: new Date(),
      },
    });
    adminId = admin.id;
    createdIds.push(admin.id);
    adminJar = await webLoginWithMfa(server, prisma, {
      id: admin.id,
      email: admin.email,
      password: ADMIN_PASSWORD,
      secret: await enrollTotp(app, prisma, admin.id),
    });
  });

  afterAll(async () => {
    const incidents = await prisma.incident.findMany({
      where: { userId: { in: createdIds } },
      select: { id: true },
    });
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
          { targetId: { in: [...createdIds, ...deviceIds] } },
          { targetId: { in: incidents.map((i) => i.id) } },
          { actorUserId: { in: createdIds } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  // --- helpers ---------------------------------------------------------------

  const as = (name: string, method: 'get' | 'post', path: string) =>
    request(server)
      [method](`${API}${path}`)
      .set('Authorization', `Bearer ${drivers[name].token}`);

  const asAdmin = (method: 'get' | 'post', path: string) => {
    const req = request(server)[method](`${API}${path}`);
    req.set('Cookie', adminJar.header());
    if (method !== 'get') {
      req
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', adminJar.get('cg_csrf') ?? '');
    }
    return req;
  };

  async function registerUnit(
    label: string,
  ): Promise<TestUnit & { id: string }> {
    const serialNumber = `CG-${stamp}-${label}`;
    const res = await asAdmin('post', '/admin/devices')
      .send({ serialNumber, label: `Unit ${label}` })
      .expect(201);
    const { device, secret } = dataOf<{ device: Device; secret: string }>(res);
    deviceIds.push(device.id);
    return { id: device.id, serialNumber, secret };
  }

  let eventSeq = 0;
  const report = (
    type: string,
    extra: Record<string, unknown> = {},
    target: TestUnit = unit,
  ) =>
    deviceRequest(server, target, `${API}/device/events`, {
      clientEventId: `evt-${stamp}-${eventSeq++}`,
      type,
      detectedAt: new Date().toISOString(),
      ...extra,
    });

  async function activeOf(name: string): Promise<IncidentDetail | null> {
    return body<IncidentDetail>(
      await as(name, 'get', '/safety/incidents/active').expect(200),
    ).data;
  }

  const later = (seconds: number) => new Date(Date.now() + seconds * 1000);

  // --- administrator device lifecycle ---------------------------------------

  describe('device administration', () => {
    it('is for administrators only, with CSRF on changes', async () => {
      await as('amira', 'get', '/admin/devices').expect(403);
      await request(server)
        .post(`${API}/admin/devices`)
        .set('Cookie', adminJar.header())
        .send({ serialNumber: `CG-${stamp}-X`, label: 'No CSRF' })
        .expect(403);
    });

    it('registers a unit and reveals its secret once', async () => {
      unit = await registerUnit('A');
      expect(Buffer.from(unit.secret, 'base64url')).toHaveLength(32);

      const res = await asAdmin('get', `/admin/devices/${unit.id}`).expect(200);
      expect(JSON.stringify(res.body)).not.toContain(unit.secret);
      expect(res.body).not.toHaveProperty('data.secretEnc');
      expect(dataOf<Device>(res)).toMatchObject({
        status: 'ACTIVE',
        pairedUserId: null,
      });

      const dup = await asAdmin('post', '/admin/devices')
        .send({ serialNumber: unit.serialNumber, label: 'Again' })
        .expect(409);
      expect(codeOf(dup)).toBe('DEVICE_SERIAL_TAKEN');
    });

    it('pairs with drivers only, one unit per driver', async () => {
      const toAdmin = await asAdmin('post', `/admin/devices/${unit.id}/pair`)
        .send({ userId: adminId })
        .expect(422);
      expect(codeOf(toAdmin)).toBe('DEVICE_PAIRING_INVALID');

      const paired = await asAdmin('post', `/admin/devices/${unit.id}/pair`)
        .send({ userId: drivers.amira.id })
        .expect(200);
      expect(dataOf<Device>(paired)).toMatchObject({
        pairedUserId: drivers.amira.id,
        pairedDriver: { firstName: 'Amira' },
      });

      const other = await registerUnit('B');
      const taken = await asAdmin('post', `/admin/devices/${other.id}/pair`)
        .send({ userId: drivers.amira.id })
        .expect(409);
      expect(codeOf(taken)).toBe('DRIVER_ALREADY_PAIRED');

      const list = await asAdmin(
        'get',
        `/admin/devices?search=${encodeURIComponent(unit.serialNumber)}`,
      ).expect(200);
      expect(dataOf<Device[]>(list).map((d) => d.id)).toEqual([unit.id]);
    });
  });

  // --- signed device requests ------------------------------------------------

  describe('device authentication', () => {
    it('accepts a signed heartbeat and records it', async () => {
      await deviceRequest(server, unit, `${API}/device/heartbeat`, {
        firmwareVersion: '1.4.2',
      }).expect(200);
      const device = await prisma.vehicleDevice.findUniqueOrThrow({
        where: { id: unit.id },
      });
      expect(device.firmwareVersion).toBe('1.4.2');
      expect(device.lastSeenAt).not.toBeNull();
    });

    it('rejects replays, tampering, stale clocks and wrong keys alike', async () => {
      const nonce = `replay-${stamp}-nonce`;
      await deviceRequest(
        server,
        unit,
        `${API}/device/heartbeat`,
        {},
        {
          nonce,
        },
      ).expect(200);

      const attempts = [
        // Built lazily: supertest binds the server per request.
        () =>
          deviceRequest(server, unit, `${API}/device/heartbeat`, {}, { nonce }),
        () =>
          deviceRequest(
            server,
            unit,
            `${API}/device/heartbeat`,
            {},
            {
              sentBody: '{"firmwareVersion":"6.6.6"}',
            },
          ),
        () =>
          deviceRequest(
            server,
            unit,
            `${API}/device/heartbeat`,
            {},
            {
              timestamp: Math.floor(Date.now() / 1000) - 600,
            },
          ),
        () =>
          deviceRequest(
            server,
            unit,
            `${API}/device/heartbeat`,
            {},
            {
              secret: Buffer.alloc(32, 1).toString('base64url'),
            },
          ),
        () => request(server).post(`${API}/device/heartbeat`).send({}),
      ];
      for (const attempt of attempts) {
        const res = await attempt().expect(401);
        expect(codeOf(res)).toBe('DEVICE_AUTH_FAILED');
      }
    });

    it('refuses events from a unit without a driver', async () => {
      const spare = await registerUnit('C');
      const res = await report('STROKE', {}, spare).expect(422);
      expect(codeOf(res)).toBe('DEVICE_NOT_PAIRED');
    });

    it('stops accepting the old secret after rotation, and everything after revocation', async () => {
      const spare = await registerUnit('D');
      const rotated = await asAdmin(
        'post',
        `/admin/devices/${spare.id}/rotate-secret`,
      ).expect(200);
      const fresh = {
        ...spare,
        secret: dataOf<{ secret: string }>(rotated).secret,
      };
      await deviceRequest(server, spare, `${API}/device/heartbeat`).expect(401);
      await deviceRequest(server, fresh, `${API}/device/heartbeat`).expect(200);

      await asAdmin('post', `/admin/devices/${spare.id}/revoke`).expect(200);
      await deviceRequest(server, fresh, `${API}/device/heartbeat`).expect(401);
      const again = await asAdmin(
        'post',
        `/admin/devices/${spare.id}/rotate-secret`,
      ).expect(422);
      expect(codeOf(again)).toBe('DEVICE_REVOKED');
    });
  });

  // --- events, countdown and "I'm OK" -----------------------------------------

  describe('events and incidents', () => {
    it('validates reports strictly', async () => {
      const bad = [
        () => report('STROKE', { confidence: 2 }),
        () => report('STROKE', { vitals: { heartRateBpm: 900 } }),
        () => report('STROKE', { location: { latitude: 120, longitude: 0 } }),
        () => report('STROKE', { unexpected: true }),
        () => report('HEADACHE'),
      ];
      for (const attempt of bad) await attempt().expect(400);

      const stale = await report('STROKE', {
        detectedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      }).expect(400);
      expect(codeOf(stale)).toBe('EVENT_TIMESTAMP_INVALID');
      expect(await activeOf('amira')).toBeNull();
    });

    it('records drowsiness as a warning without an incident', async () => {
      const res = await report('DROWSINESS', {
        confidence: 0.82,
        vitals: { eyeClosurePercent: 41 },
      }).expect(200);
      expect(dataOf<Receipt>(res)).toMatchObject({
        incidentId: null,
        duplicate: false,
      });
      expect(await activeOf('amira')).toBeNull();

      const list = await as('amira', 'get', '/safety/events').expect(200);
      expect(dataOf<{ type: string; severity: string }[]>(list)[0]).toEqual(
        expect.objectContaining({ type: 'DROWSINESS', severity: 'WARNING' }),
      );
    });

    it('opens a critical incident with a 30 s countdown, idempotently', async () => {
      const payload = {
        clientEventId: `stroke-${stamp}`,
        type: 'STROKE',
        detectedAt: new Date().toISOString(),
        confidence: 0.91,
        vitals: { heartRateBpm: 112, rhythm: 'IRREGULAR' },
      };
      const first = dataOf<Receipt>(
        await deviceRequest(
          server,
          unit,
          `${API}/device/events`,
          payload,
        ).expect(200),
      );
      expect(first.incidentStatus).toBe('AWAITING_RESPONSE');
      const countdown =
        (new Date(first.respondBy!).getTime() - Date.now()) / 1000;
      expect(countdown).toBeGreaterThan(25);
      expect(countdown).toBeLessThanOrEqual(30);

      const replay = dataOf<Receipt>(
        await deviceRequest(
          server,
          unit,
          `${API}/device/events`,
          payload,
        ).expect(200),
      );
      expect(replay).toMatchObject({
        eventId: first.eventId,
        incidentId: first.incidentId,
        duplicate: true,
      });

      const conflict = await deviceRequest(
        server,
        unit,
        `${API}/device/events`,
        {
          ...payload,
          type: 'SEIZURE',
        },
      ).expect(409);
      expect(codeOf(conflict)).toBe('EVENT_ID_CONFLICT');

      // A less severe detection joins the incident without changing it.
      const rhythm = dataOf<Receipt>(await report('HEART_RHYTHM').expect(200));
      expect(rhythm.incidentId).toBe(first.incidentId);

      const active = (await activeOf('amira'))!;
      expect(active.incident).toMatchObject({
        id: first.incidentId,
        severity: 'CRITICAL',
        triggerType: 'STROKE',
      });
      expect(active.events.map((e) => e.type)).toEqual([
        'STROKE',
        'HEART_RHYTHM',
      ]);
      expect(active.incident.respondBy).toBe(first.respondBy);

      const detail = await as(
        'amira',
        'get',
        `/safety/events/${first.eventId}`,
      ).expect(200);
      expect(dataOf<{ vitals: unknown }>(detail).vitals).toEqual({
        heartRateBpm: 112,
        rhythm: 'IRREGULAR',
      });
      await as('bilel', 'get', `/safety/events/${first.eventId}`).expect(404);
    });

    it('cancels as a false alarm when the driver answers in time', async () => {
      const active = (await activeOf('amira'))!;
      const ok = await as(
        'amira',
        'post',
        `/safety/incidents/${active.incident.id}/acknowledge`,
      ).expect(200);
      expect(dataOf<Incident>(ok).status).toBe('FALSE_ALARM');

      // Retried tap: same answer, no error.
      const again = await as(
        'amira',
        'post',
        `/safety/incidents/${active.incident.id}/acknowledge`,
      ).expect(200);
      expect(dataOf<Incident>(again).status).toBe('FALSE_ALARM');

      await escalation.runOnce(later(120));
      const closed = dataOf<IncidentDetail>(
        await as(
          'amira',
          'get',
          `/safety/incidents/${active.incident.id}`,
        ).expect(200),
      );
      expect(closed.notifications).toEqual([]);
      expect(closed.incident.location).toBeNull();
      expect(await activeOf('amira')).toBeNull();
      await as(
        'bilel',
        'post',
        `/safety/incidents/${active.incident.id}/acknowledge`,
      ).expect(404);
    });

    it('opens one incident for simultaneous detections, and an SOS escalates it', async () => {
      const receipts = await Promise.all(
        ['STROKE', 'CARDIAC_ARREST', 'SEIZURE'].map(async (type) =>
          dataOf<Receipt>(await report(type).expect(200)),
        ),
      );
      const ids = new Set(receipts.map((r) => r.incidentId));
      expect(ids.size).toBe(1);
      const [incidentId] = [...ids];

      const sos = dataOf<Incident>(
        await as('amira', 'post', '/safety/sos')
          .send({ clientEventId: `sos-${stamp}-during` })
          .expect(201),
      );
      expect(sos).toMatchObject({ id: incidentId, status: 'ESCALATED' });

      await as(
        'amira',
        'post',
        `/safety/incidents/${incidentId}/acknowledge`,
      ).expect(200);
      // Clear the alert and all-clear so later counts start fresh.
      await escalation.runOnce();
      alerts.length = 0;
      allClears.length = 0;
    });
  });

  // --- escalation ------------------------------------------------------------

  describe('escalation', () => {
    let incidentId: string;

    it('escalates an unanswered urgent incident after 60 s and alerts everyone', async () => {
      const receipt = dataOf<Receipt>(
        await report('HEART_RHYTHM', {
          location: { latitude: 36.8065, longitude: 10.1815, accuracyM: 8 },
        }).expect(200),
      );
      incidentId = receipt.incidentId!;
      expect(receipt.incidentStatus).toBe('AWAITING_RESPONSE');

      await escalation.runOnce(later(30));
      expect((await activeOf('amira'))!.incident.status).toBe(
        'AWAITING_RESPONSE',
      );

      await escalation.runOnce(later(61));
      const detail = (await activeOf('amira'))!;
      expect(detail.incident.status).toBe('ESCALATED');
      expect(detail.timeline.map((t) => t.kind)).toEqual([
        'OPENED',
        'ESCALATED',
        'NOTIFIED',
      ]);
      expect(
        detail.notifications.map((n) => [n.recipientName, n.channel, n.status]),
      ).toEqual([
        ['Sami Contact', 'LOG', 'SENT'],
        ['Lina Contact', 'LOG', 'SENT'],
        ['Bilel Driver', 'EMAIL', 'SENT'],
      ]);
      expect(alerts).toEqual([
        expect.objectContaining({
          to: `safety-bilel-${stamp}@cabinguard.test`,
          driverName: 'Amira Driver',
        }),
      ]);

      // Another pass delivers nothing twice.
      await escalation.runOnce(later(90));
      expect((await activeOf('amira'))!.notifications).toHaveLength(3);
    });

    it('shows family members the emergency, never its cause', async () => {
      const seen = dataOf<Record<string, unknown>[]>(
        await as('bilel', 'get', '/families/mine/incidents').expect(200),
      );
      // The earlier false alarm never reached anyone, so it is not listed;
      // the SOS from the race test escalated and was resolved.
      expect(seen.map((i) => i.status)).toEqual(['ESCALATED', 'RESOLVED']);
      expect(seen[0]).toMatchObject({
        incidentId,
        member: { userId: drivers.amira.id, firstName: 'Amira' },
        location: { latitude: 36.8065, longitude: 10.1815 },
      });
      expect(seen[1].location).toBeNull();
      expect(JSON.stringify(seen)).not.toMatch(
        /HEART_RHYTHM|STROKE|SOS|triggerType|severity|vitals/,
      );

      const outsider = await as(
        'chaima',
        'get',
        '/families/mine/incidents',
      ).expect(200);
      expect(dataOf<unknown[]>(outsider)).toEqual([]);
    });

    it('resolves from the cabin button and sends the all-clear', async () => {
      const res = await deviceRequest(
        server,
        unit,
        `${API}/device/acknowledge`,
      ).expect(200);
      expect(dataOf<{ status: string }>(res)).toEqual({
        incidentId,
        status: 'RESOLVED',
      });

      await escalation.runOnce();
      const detail = dataOf<IncidentDetail>(
        await as('amira', 'get', `/safety/incidents/${incidentId}`).expect(200),
      );
      expect(detail.incident.resolvedVia).toBe('DEVICE');
      expect(
        detail.notifications.filter((n) => n.kind === 'ALL_CLEAR'),
      ).toHaveLength(3);
      expect(allClears.map((m) => m.driverName)).toEqual(['Amira Driver']);

      const none = await deviceRequest(
        server,
        unit,
        `${API}/device/acknowledge`,
      ).expect(422);
      expect(codeOf(none)).toBe('NO_ACTIVE_INCIDENT');
    });
  });

  // --- SOS, auto-close, retention, dashboard --------------------------------

  describe('SOS', () => {
    it('escalates immediately and is safe to retry', async () => {
      const sos = {
        clientEventId: `sos-${stamp}-amira`,
        location: { latitude: 36.81, longitude: 10.17 },
      };
      const first = dataOf<Incident>(
        await as('amira', 'post', '/safety/sos').send(sos).expect(201),
      );
      expect(first).toMatchObject({
        status: 'ESCALATED',
        triggerType: 'SOS',
        respondBy: null,
      });
      const retry = dataOf<Incident>(
        await as('amira', 'post', '/safety/sos').send(sos).expect(201),
      );
      expect(retry.id).toBe(first.id);

      await escalation.dispatchPending();
      expect((await activeOf('amira'))!.notifications).toHaveLength(3);

      await as(
        'amira',
        'post',
        `/safety/incidents/${first.id}/acknowledge`,
      ).expect(200);
    });

    it('closes forgotten escalations after a day, without an all-clear', async () => {
      const sos = dataOf<Incident>(
        await as('chaima', 'post', '/safety/sos')
          .send({ clientEventId: `sos-${stamp}-chaima` })
          .expect(201),
      );
      await escalation.runOnce(later(25 * 3600));
      const detail = dataOf<IncidentDetail>(
        await as('chaima', 'get', `/safety/incidents/${sos.id}`).expect(200),
      );
      expect(detail.incident).toMatchObject({
        status: 'RESOLVED',
        resolvedVia: 'SYSTEM',
      });
      // No contacts, no family: the attempt is still on record.
      expect(detail.timeline.map((t) => t.kind)).toEqual([
        'OPENED',
        'ESCALATED',
        'NOTIFIED',
        'RESOLVED',
      ]);
      expect(detail.notifications).toEqual([]);
    });
  });

  describe('retention and dashboard', () => {
    it('purges old event details and incident summaries', async () => {
      const old = await prisma.medicalEvent.create({
        data: {
          userId: drivers.chaima.id,
          source: 'DEVICE',
          type: 'HEART_RHYTHM',
          severity: 'URGENT',
          clientEventId: `old-${stamp}`,
          detectedAt: new Date(Date.now() - 100 * 86_400_000),
          receivedAt: new Date(Date.now() - 100 * 86_400_000),
          latitude: 36.8,
          longitude: 10.1,
        },
      });
      const ancient = await prisma.incident.create({
        data: {
          userId: drivers.chaima.id,
          status: 'RESOLVED',
          severity: 'URGENT',
          triggerType: 'HEART_RHYTHM',
          openedAt: new Date(Date.now() - 400 * 86_400_000),
        },
      });

      const report = await app.get(SafetyRetentionService).purge();
      expect(report.events).toBeGreaterThanOrEqual(1);
      expect(report.incidents).toBeGreaterThanOrEqual(1);
      expect(
        await prisma.medicalEvent.findUnique({ where: { id: old.id } }),
      ).toBeNull();
      expect(
        await prisma.incident.findUnique({ where: { id: ancient.id } }),
      ).toBeNull();
    });

    it('summarizes the unit, the open incident and the last event on the home screen', async () => {
      await deviceRequest(server, unit, `${API}/device/heartbeat`).expect(200);
      await report('SEIZURE').expect(200);

      const dashboard = dataOf<{
        monitoring: {
          device: { paired: boolean; online: boolean };
          activeIncident: { status: string; triggerType: string } | null;
          latestEvent: {
            type: string;
            incidentStatus: string | null;
            contactsAlerted: boolean;
          } | null;
        };
        features: { medicalEvents: boolean; emergencyAlerts: boolean };
      }>(await as('amira', 'get', '/mobile/dashboard').expect(200));
      expect(dashboard.monitoring).toMatchObject({
        device: { paired: true, online: true },
        activeIncident: { status: 'AWAITING_RESPONSE', triggerType: 'SEIZURE' },
        latestEvent: {
          type: 'SEIZURE',
          incidentStatus: 'AWAITING_RESPONSE',
          contactsAlerted: false,
        },
      });
      expect(dashboard.features).toMatchObject({
        medicalEvents: true,
        emergencyAlerts: true,
      });

      const unpaired = dataOf<{
        monitoring: { device: { paired: boolean }; activeIncident: unknown };
      }>(await as('bilel', 'get', '/mobile/dashboard').expect(200));
      expect(unpaired.monitoring).toMatchObject({
        device: { paired: false },
        activeIncident: null,
      });
    });
  });

  describe('AI gateway integration', () => {
    let gateway: TestUnit & { id: string };
    let associationId: string;

    const payload = (extra: Record<string, unknown> = {}) => {
      const at = new Date().toISOString();
      const eventId = randomUUID();
      return {
        clientEventId: eventId,
        type: 'CARDIAC_EMERGENCY',
        confidence: 0.92,
        detectedAt: at,
        ai: {
          schemaVersion: 1,
          associationId,
          episodeId: eventId,
          inputKind: 'SENSOR',
          model: 'Cardiac',
          modelSha256: AI_MODEL_HASHES.Cardiac,
          featureVersion: '1',
          decisionVersion: '1',
          windowStartAt: at,
          windowEndAt: at,
        },
        ...extra,
      };
    };
    const send = (body: object) =>
      deviceRequest(server, gateway, `${API}/device/ai/events`, body);

    it('is active from pairing and negotiates an authenticated association', async () => {
      gateway = await registerUnit('AI');
      await asAdmin('post', `/admin/devices/${gateway.id}/pair`)
        .send({ userId: drivers.ai.id })
        .expect(200);
      const session = dataOf<{
        associationId: string;
        mode: string;
        paired: boolean;
      }>(
        await deviceRequest(
          server,
          gateway,
          `${API}/device/ai/session`,
          undefined,
          { method: 'GET' },
        ).expect(200),
      );
      associationId = session.associationId;
      expect(session).toMatchObject({ mode: 'ACTIVE', paired: true });
      expect(await activeOf('ai')).toBeNull();
    });

    it('validates provenance and exposes it only to the owning driver', async () => {
      // Replayed input: checks the contract without opening an incident.
      const live = payload();
      const body = { ...live, ai: { ...live.ai, inputKind: 'REPLAY' } };
      const first = dataOf<Receipt>(await send(body).expect(200));
      expect(dataOf<Receipt>(await send(body).expect(200))).toMatchObject({
        eventId: first.eventId,
        duplicate: true,
      });
      expect(codeOf(await send({ ...body, confidence: 0.8 }).expect(409))).toBe(
        'EVENT_ID_CONFLICT',
      );
      await send({ ...payload(), ai: undefined }).expect(400);
      await send({
        ...payload(),
        ai: { ...body.ai, modelSha256: '0'.repeat(64) },
      }).expect(409);
      const detail = dataOf<{
        processingMode: string;
        detection: { model: string };
      }>(await as('ai', 'get', `/safety/events/${first.eventId}`).expect(200));
      expect(detail.processingMode).toBe('REPLAY');
      expect(detail.detection.model).toBe('Cardiac');
      await as('bilel', 'get', `/safety/events/${first.eventId}`).expect(404);
      await asAdmin('get', `/safety/events/${first.eventId}`).expect(403);
    });

    it('never activates replay or delayed data', async () => {
      const replay = payload();
      expect(
        dataOf<{ processingMode: string }>(
          await send({
            ...replay,
            ai: { ...replay.ai, inputKind: 'REPLAY' },
          }).expect(200),
        ).processingMode,
      ).toBe('REPLAY');
      await prisma.vehicleDevice.update({
        where: { id: gateway.id },
        data: { pairedAt: new Date(Date.now() - 180000) },
      });
      const at = new Date(Date.now() - 120000).toISOString();
      const delayed = payload({ detectedAt: at });
      expect(
        dataOf<{ processingMode: string }>(
          await send({
            ...delayed,
            ai: { ...delayed.ai, windowStartAt: at, windowEndAt: at },
          }).expect(200),
        ).processingMode,
      ).toBe('DELAYED');
      expect(await activeOf('ai')).toBeNull();
    });

    it('opens one active incident and preserves independent concurrent detector alarms', async () => {
      const cardiac = payload();
      const seizure = payload({ type: 'SEIZURE' });
      const results = await Promise.all([
        send(cardiac).expect(200),
        send({
          ...seizure,
          ai: {
            ...seizure.ai,
            model: 'Seizure',
            modelSha256: AI_MODEL_HASHES.Seizure,
          },
        }).expect(200),
      ]);
      const receipts = results.map((r) => dataOf<Receipt>(r));
      expect(receipts[0].incidentId).toBeTruthy();
      expect(receipts[1].incidentId).toBe(receipts[0].incidentId);
      const incident = (await activeOf('ai'))!;
      expect(incident.events.map((e) => e.type).sort()).toEqual([
        'CARDIAC_EMERGENCY',
        'SEIZURE',
      ]);
      await as(
        'ai',
        'post',
        `/safety/incidents/${incident.incident.id}/acknowledge`,
      ).expect(200);
      await send(cardiac).expect(200);
      expect(await activeOf('ai')).toBeNull();
    });

    it('reports operational health and rejects buffered events after reassignment', async () => {
      const health = {
        associationId,
        runtimeVersion: '0.1.0',
        bootId: randomUUID(),
        queueDepth: 2,
        cardiac: 'READY',
        seizure: 'READY',
        stroke: 'WARMING_UP',
      };
      await deviceRequest(
        server,
        gateway,
        `${API}/device/ai/heartbeat`,
        health,
      ).expect(200);
      expect(
        dataOf<{ status: string }>(
          await asAdmin(
            'get',
            `/admin/devices/${gateway.id}/monitoring`,
          ).expect(200),
        ).status,
      ).toBe('WARMING_UP');
      const old = payload();
      await asAdmin('post', `/admin/devices/${gateway.id}/unpair`).expect(200);
      await asAdmin('post', `/admin/devices/${gateway.id}/pair`)
        .send({ userId: drivers.ai.id })
        .expect(200);
      expect(codeOf(await send(old).expect(409))).toBe(
        'AI_ASSOCIATION_EXPIRED',
      );
      await deviceRequest(
        server,
        gateway,
        `${API}/device/ai/heartbeat`,
        health,
      ).expect(409);
      expect(
        dataOf<{ status: string }>(
          await asAdmin(
            'get',
            `/admin/devices/${gateway.id}/monitoring`,
          ).expect(200),
        ).status,
      ).toBe('UNAVAILABLE');
    });

    (process.env.AI_GATEWAY_PYTHON ? it : it.skip)(
      'runs the actual Python models through signed HTTP into driver history',
      async () => {
        await app.listen(0, '127.0.0.1');
        const address = app.getHttpServer().address();
        if (!address || typeof address === 'string')
          throw new Error('Expected a local TCP listener');
        const queuePath = join(
          tmpdir(),
          `cabinguard-ai-test-${randomUUID()}.sqlite`,
        );
        const before = await prisma.medicalEvent.count({
          where: { userId: drivers.ai.id },
        });
        try {
          const { stdout } = await promisify(execFile)(
            process.env.AI_GATEWAY_PYTHON!,
            [
              '-m',
              'gateway.replay',
              '--api',
              `http://127.0.0.1:${address.port}${API}`,
              '--serial',
              gateway.serialNumber,
              '--scenario',
              'Stroke',
              '--fast',
              '--outbox',
              queuePath,
            ],
            {
              cwd: resolve(__dirname, '../../AI module/dashboard_ai_models'),
              env: { ...process.env, CABINGUARD_DEVICE_SECRET: gateway.secret },
              timeout: 60000,
            },
          );
          expect(stdout).toContain('pending events: 0');
          expect(
            await prisma.medicalEvent.count({
              where: { userId: drivers.ai.id },
            }),
          ).toBeGreaterThan(before);
          expect(await activeOf('ai')).toBeNull();
          const latest = await prisma.medicalEvent.findFirst({
            where: { userId: drivers.ai.id },
            orderBy: { receivedAt: 'desc' },
          });
          expect(latest?.detection).toMatchObject({
            inputKind: 'REPLAY',
            processingMode: 'REPLAY',
          });
        } finally {
          await Promise.all(
            ['', '-wal', '-shm'].map((suffix) =>
              rm(queuePath + suffix, { force: true }),
            ),
          );
        }
      },
      70000,
    );
  });
});
