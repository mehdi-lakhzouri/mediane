import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getStorageToken } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PasswordHasher } from '../src/modules/security/application/password-hasher';
import { MailSender } from '../src/modules/mail/application/mail-sender';
import type { AdminIncidentStats } from '../src/modules/safety/domain/admin-incident.repository';
import type { CookieJar } from './utils/cookie-jar';
import { enrollTotp, webLoginWithMfa } from './utils/mfa';

const API = '/api/v1/admin/incidents';
const PASSWORD = 'Incident-Review-Passphrase-17';
const unwrap = <T>(response: { body: unknown }): T =>
  (response.body as { data: T }).data;

describe('Administrative incident operations (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let db: PrismaService;
  let jar: CookieJar;
  let driverToken: string;
  let driverEmail: string;
  let awaitingId: string;
  let baseline: AdminIncidentStats;
  const users: string[] = [];
  const stamp = randomUUID();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
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
        sendInvitation: async () => {},
        sendPasswordReset: async () => {},
        sendFamilyIncidentAlert: async () => {},
        sendFamilyAllClear: async () => {},
      })
      .compile();
    app = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
    db = app.get(PrismaService);
    const passwordHash = await app.get(PasswordHasher).hash(PASSWORD);
    const admin = await db.user.create({
      data: {
        email: `incident-admin-${stamp}@example.test`,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: 'Incident',
        lastName: 'Admin',
        emailVerifiedAt: new Date(),
      },
    });
    users.push(admin.id);
    jar = await webLoginWithMfa(server, db, {
      id: admin.id,
      email: admin.email,
      password: PASSWORD,
      secret: await enrollTotp(app, db, admin.id),
    });
    baseline = unwrap<AdminIncidentStats>(
      await request(server)
        .get(`${API}/stats`)
        .set('Cookie', jar.header())
        .expect(200),
    );
    for (const [index, firstName] of ['Amira', 'Bilel'].entries()) {
      const user = await db.user.create({
        data: {
          email: `incident-driver-${index}-${stamp}@example.test`,
          passwordHash,
          role: 'DRIVER',
          status: 'ACTIVE',
          firstName,
          lastName: 'Review',
          emailVerifiedAt: new Date(),
          profileCompletedAt: new Date(),
        },
      });
      users.push(user.id);
      if (index === 0) {
        driverEmail = user.email;
        driverToken = unwrap<{ accessToken: string }>(
          await request(server)
            .post('/api/v1/auth/mobile/login')
            .send({ email: user.email, password: PASSWORD })
            .expect(200),
        ).accessToken;
      }
    }
    const now = new Date();
    const awaiting = await db.incident.create({
      data: {
        userId: users[1],
        status: 'AWAITING_RESPONSE',
        severity: 'URGENT',
        triggerType: 'STROKE',
        openedAt: now,
        respondBy: new Date(now.getTime() + 30_000),
        latitude: 36.8,
        longitude: 10.1,
      },
    });
    awaitingId = awaiting.id;
    await db.incident.createMany({
      data: [
        {
          userId: users[2],
          status: 'ESCALATED',
          severity: 'CRITICAL',
          triggerType: 'SOS',
          openedAt: now,
          escalatedAt: now,
        },
        {
          userId: users[1],
          status: 'RESOLVED',
          severity: 'URGENT',
          triggerType: 'SEIZURE',
          openedAt: new Date(now.getTime() - 40 * 86_400_000),
          resolvedAt: now,
          resolvedVia: 'SYSTEM',
        },
        {
          userId: users[1],
          status: 'FALSE_ALARM',
          severity: 'URGENT',
          triggerType: 'STROKE',
          openedAt: new Date(now.getTime() - 2 * 86_400_000),
          acknowledgedAt: now,
          acknowledgedVia: 'APP',
        },
      ],
    });
    await db.medicalEvent.create({
      data: {
        userId: users[1],
        incidentId: awaiting.id,
        source: 'DEVICE',
        type: 'STROKE',
        severity: 'URGENT',
        clientEventId: randomUUID(),
        confidence: 0.93,
        detectedAt: now,
        vitals: { secretMedicalEvidence: 'private-reading' },
      },
    });
    await db.incidentTimelineEntry.create({
      data: {
        incidentId: awaiting.id,
        kind: 'OPENED',
        at: now,
        detail: { privateContext: 'do-not-project' },
      },
    });
    await db.incidentNotification.create({
      data: {
        incidentId: awaiting.id,
        kind: 'ALERT',
        recipientType: 'EMERGENCY_CONTACT',
        recipientName: 'Private recipient identity',
        channel: 'LOG',
        status: 'SENT',
        error: 'private-error-context',
      },
    });
  });

  afterAll(async () => {
    if (db) {
      await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    await app?.close();
  });

  it('requires an active administrator for list, counts and details', async () => {
    for (const path of [API, `${API}/stats`, `${API}/${awaitingId}`]) {
      await request(server).get(path).expect(401);
      await request(server)
        .get(path)
        .auth(driverToken, { type: 'bearer' })
        .expect(403);
      await request(server).get(path).set('Cookie', jar.header()).expect(200);
    }
    await request(server)
      .get('/api/v1/safety/incidents')
      .set('Cookie', jar.header())
      .expect(403);
  });

  it('paginates all driver incidents, searches and filters before paging', async () => {
    const first = await request(server)
      .get(API)
      .query({
        search: driverEmail,
        page: 1,
        pageSize: 1,
        sortBy: 'openedAt',
        sortDir: 'desc',
      })
      .set('Cookie', jar.header())
      .expect(200);
    expect(unwrap<{ id: string }[]>(first).map((row) => row.id)).toEqual([
      awaitingId,
    ]);
    expect(
      (first.body as { meta: { pagination: { totalItems: number } } }).meta
        .pagination.totalItems,
    ).toBe(3);
    const second = await request(server)
      .get(API)
      .query({
        search: driverEmail,
        page: 2,
        pageSize: 1,
        sortBy: 'openedAt',
        sortDir: 'desc',
      })
      .set('Cookie', jar.header())
      .expect(200);
    expect(unwrap<{ status: string }[]>(second)[0].status).toBe('FALSE_ALARM');
    const recent = await request(server)
      .get(API)
      .query({ search: driverEmail, period: '24h' })
      .set('Cookie', jar.header())
      .expect(200);
    expect(unwrap<{ id: string }[]>(recent).map((row) => row.id)).toEqual([
      awaitingId,
    ]);
    const status = await request(server)
      .get(API)
      .query({ search: driverEmail, status: 'RESOLVED' })
      .set('Cookie', jar.header())
      .expect(200);
    expect(
      unwrap<{ status: string }[]>(status).map((row) => row.status),
    ).toEqual(['RESOLVED']);
    const byId = await request(server)
      .get(API)
      .query({ search: awaitingId })
      .set('Cookie', jar.header())
      .expect(200);
    expect(unwrap<{ id: string }[]>(byId).map((row) => row.id)).toEqual([
      awaitingId,
    ]);
  });

  it('reports global counts independently of table filters', async () => {
    const stats = unwrap<AdminIncidentStats>(
      await request(server)
        .get(`${API}/stats`)
        .set('Cookie', jar.header())
        .expect(200),
    );
    expect(stats).toEqual({
      total: baseline.total + 4,
      awaitingResponse: baseline.awaitingResponse + 1,
      escalated: baseline.escalated + 1,
      resolved: baseline.resolved + 1,
      falseAlarm: baseline.falseAlarm + 1,
    });
  });

  it('projects only operational fields, including redacted timeline and dispatch history', async () => {
    const list = await request(server)
      .get(API)
      .query({ search: awaitingId })
      .set('Cookie', jar.header())
      .expect(200);
    const detail = await request(server)
      .get(`${API}/${awaitingId}`)
      .set('Cookie', jar.header())
      .expect(200);
    const row = unwrap<{
      eventCount: number;
      notificationCount: number;
      driver: { email: string };
      timeline: object[];
      notifications: object[];
    }>(detail);
    expect(row.driver.email).toBe(driverEmail);
    expect(row.eventCount).toBe(1);
    expect(row.notificationCount).toBe(1);
    expect(Object.keys(row.timeline[0]).sort()).toEqual(['at', 'id', 'kind']);
    expect(Object.keys(row.notifications[0]).sort()).toEqual([
      'attemptedAt',
      'channel',
      'id',
      'kind',
      'status',
    ]);
    for (const response of [list, detail]) {
      const json = JSON.stringify(response.body);
      for (const field of [
        'triggerType',
        'severity',
        'confidence',
        'latitude',
        'longitude',
        'vitals',
        'detection',
        'recipientName',
        'recipientUserId',
        'private-reading',
        'do-not-project',
        'Private recipient identity',
        'private-error-context',
      ])
        expect(json).not.toContain(field);
    }
  });

  it('validates filters and identifiers and returns 404 for an unknown incident', async () => {
    for (const query of [
      { status: 'ALL' },
      { pageSize: 101 },
      { sortBy: 'severity' },
      { period: 'all' },
      { search: 'x'.repeat(129) },
      { triggerType: 'STROKE' },
    ]) {
      await request(server)
        .get(API)
        .query(query)
        .set('Cookie', jar.header())
        .expect(400);
    }
    await request(server)
      .get(`${API}/invalid-id`)
      .set('Cookie', jar.header())
      .expect(400);
    await request(server)
      .get(`${API}/${randomUUID()}`)
      .set('Cookie', jar.header())
      .expect(404);
  });
});
