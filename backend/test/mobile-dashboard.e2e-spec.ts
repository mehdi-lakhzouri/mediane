import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getStorageToken } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { MailSender } from '../src/modules/mail/application/mail-sender';
import { PasswordHasher } from '../src/modules/security/application/password-hasher';

/**
 * The mobile home screen summary: one read aggregating the driver's own
 * profile, family and security state. Rate limiting is neutralized.
 */
const API = '/api/v1';
const PASSWORD = 'Dashboard-Driver-Passphrase-1';

interface Envelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}
interface Dashboard {
  serverTime: string;
  driver: { userId: string; firstName: string; lastName: string; role: string };
  safety: {
    ready: boolean;
    emergencyContactCount: number;
    recommendations: string[];
  };
  family: {
    state: string;
    name: string | null;
    memberCount: number | null;
    maxMembers: number | null;
    pendingJoinRequests: number | null;
    pendingRequest: { familyName: string; expiresAt: string } | null;
  };
  security: { mfaEnabled: boolean; recoveryCodesLow: boolean };
  monitoring: Record<string, unknown>;
  features: Record<string, boolean>;
}

const body = <T>(res: { body: unknown }) => res.body as Envelope<T>;

const profile = (phoneNumber: string) => ({
  phoneNumber,
  dateOfBirth: '1990-05-17',
  gender: 'FEMALE',
  emergencyContacts: [
    {
      fullName: 'Amira Ben Salah',
      relationship: 'SPOUSE',
      phoneNumber: '+21698765432',
    },
    {
      fullName: 'Karim Ben Salah',
      relationship: 'SIBLING',
      phoneNumber: '+21655111222',
    },
  ],
});

describe('Mobile dashboard (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let prisma: PrismaService;
  const stamp = Date.now();
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
  });

  afterAll(async () => {
    await prisma.family.deleteMany({
      where: { members: { some: { userId: { in: createdIds } } } },
    });
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

  /** A driver who set their own password; the profile is still missing. */
  async function signInNewDriver(
    name: string,
  ): Promise<{ token: string; userId: string }> {
    const email = `dashboard-${name.toLowerCase()}-${stamp}@cabinguard.test`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await app.get(PasswordHasher).hash(PASSWORD),
        role: 'DRIVER',
        status: 'ACTIVE',
        firstName: name,
        lastName: 'Driver',
        emailVerifiedAt: new Date(),
      },
    });
    createdIds.push(user.id);
    const res = await request(server)
      .post(`${API}/auth/mobile/login`)
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      token: body<{ accessToken: string }>(res).data!.accessToken,
      userId: user.id,
    };
  }

  const as = (token: string, method: 'get' | 'post' | 'put', path: string) =>
    request(server)
      [method](`${API}${path}`)
      .set('Authorization', `Bearer ${token}`);

  async function dashboardOf(token: string): Promise<Dashboard> {
    const res = await as(token, 'get', '/mobile/dashboard').expect(200);
    return body<Dashboard>(res).data!;
  }

  it('requires a signed-in driver', async () => {
    const res = await request(server)
      .get(`${API}/mobile/dashboard`)
      .expect(401);
    expect(body(res).error?.code).toBeDefined();
  });

  it('waits for the profile before showing the dashboard', async () => {
    const { token } = await signInNewDriver('Pending');
    const res = await as(token, 'get', '/mobile/dashboard').expect(403);
    expect(body(res).error?.code).toBe('PROFILE_SETUP_REQUIRED');
  });

  it('summarizes the driver, family and security state', async () => {
    const owner = await signInNewDriver('Owner');
    await as(owner.token, 'put', '/profile')
      .send(profile('+21612345678'))
      .expect(200);

    const alone = await dashboardOf(owner.token);
    expect(alone).toMatchObject({
      serverTime: expect.any(String),
      driver: {
        userId: owner.userId,
        firstName: 'Owner',
        lastName: 'Driver',
        role: 'DRIVER',
      },
      safety: { ready: true, emergencyContactCount: 2 },
      family: {
        state: 'NONE',
        name: null,
        pendingJoinRequests: null,
        pendingRequest: null,
      },
      security: { mfaEnabled: false, recoveryCodesLow: false },
      monitoring: {
        device: { paired: false, online: false, lastSeenAt: null },
        activeIncident: null,
        latestEvent: null,
      },
      notifications: { unread: 0 },
      features: {
        medicalEvents: true,
        emergencyAlerts: true,
        notifications: true,
        vehicleTelemetry: false,
      },
    });
    expect(alone.safety.recommendations).toEqual([
      'ENABLE_TWO_STEP',
      'JOIN_OR_CREATE_FAMILY',
    ]);

    await as(owner.token, 'post', '/families')
      .send({ name: `Ben Salah ${stamp}` })
      .expect(201);
    const invite = await as(owner.token, 'get', '/families/mine/invite').expect(
      200,
    );
    const code = body<{ code: string }>(invite).data!.code;

    const requester = await signInNewDriver('Requester');
    await as(requester.token, 'put', '/profile')
      .send(profile('+21622345678'))
      .expect(200);
    await as(requester.token, 'post', '/families/join')
      .send({ code })
      .expect((res) => expect([200, 201]).toContain(res.status));

    expect((await dashboardOf(owner.token)).family).toMatchObject({
      state: 'OWNER',
      name: `Ben Salah ${stamp}`,
      memberCount: 1,
      maxMembers: expect.any(Number),
      pendingJoinRequests: 1,
    });
    const waiting = await dashboardOf(requester.token);
    expect(waiting.family).toMatchObject({
      state: 'REQUEST_PENDING',
      name: null,
      pendingRequest: { familyName: `Ben Salah ${stamp}` },
    });
    expect(waiting.safety.recommendations).not.toContain(
      'JOIN_OR_CREATE_FAMILY',
    );
  });
});
