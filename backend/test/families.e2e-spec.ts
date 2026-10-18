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
import type { CookieJar } from './utils/cookie-jar';
import { enrollTotp, webLoginWithMfa } from './utils/mfa';

/**
 * Families end to end against PostgreSQL: creation, code + link invitations,
 * owner approval, consent-based sharing, ownership rules, capacity,
 * concurrency, account lifecycle and console management.
 */
const API = '/api/v1';
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Family-Driver-Passphrase-1';
const ADMIN_PASSWORD = 'Family-Admin-Passphrase-2';

interface Envelope<T> {
  data: T | null;
  error: { code: string } | null;
}
interface Member {
  userId: string;
  firstName: string;
  role: string;
  phoneNumber: string | null;
  sharing: { phone: boolean; incidents: boolean; health: boolean };
}
interface MyFamily {
  family: {
    id: string;
    name: string;
    myRole: string;
    members: Member[];
    pendingRequestCount: number | null;
  } | null;
  pendingRequest: { id: string; familyName: string; status: string } | null;
}
interface Invite {
  code: string;
  link: string;
  expiresAt: string;
}

const body = <T>(res: { body: unknown }) => res.body as Envelope<T>;
const codeOf = (res: { body: unknown }) => body(res).error?.code;

describe('Families (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let prisma: PrismaService;
  const stamp = Date.now();
  const createdIds: string[] = [];
  /** name -> { id, token } for drivers who sign in. */
  const drivers: Record<string, { id: string; token: string }> = {};
  let adminJar: CookieJar;
  let familyId: string;
  let invite: Invite;

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

    const hash = await app.get(PasswordHasher).hash(PASSWORD);
    for (const name of ['amira', 'bilel', 'chaima', 'dali', 'emna']) {
      const user = await prisma.user.create({
        data: {
          email: `family-${name}-${stamp}@cabinguard.test`,
          passwordHash: hash,
          role: 'DRIVER',
          status: 'ACTIVE',
          firstName: name[0].toUpperCase() + name.slice(1),
          lastName: 'Driver',
          emailVerifiedAt: new Date(),
          profileCompletedAt: new Date(),
          // Join order matters for automatic ownership transfer.
          createdAt: new Date(Date.now() - 1000),
        },
      });
      createdIds.push(user.id);
      const login = await request(server)
        .post(`${API}/auth/mobile/login`)
        .send({ email: user.email, password: PASSWORD })
        .expect(200);
      drivers[name] = {
        id: user.id,
        token: body<{ accessToken: string }>(login).data!.accessToken,
      };
    }
    // Bilel has a phone number on his profile (shared only with consent).
    await prisma.userProfile.create({
      data: {
        userId: drivers.bilel.id,
        phoneNumber: '+21655123456',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'MALE',
      },
    });

    const admin = await prisma.user.create({
      data: {
        email: `family-admin-${stamp}@cabinguard.test`,
        passwordHash: await app.get(PasswordHasher).hash(ADMIN_PASSWORD),
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: 'Family',
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

  const as = (
    name: string,
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
  ) =>
    request(server)
      [method](`${API}${path}`)
      .set('Authorization', `Bearer ${drivers[name].token}`);

  const asAdmin = (method: 'get' | 'post' | 'delete', path: string) => {
    const req = request(server)[method](`${API}${path}`);
    req.set('Cookie', adminJar.header());
    if (method !== 'get') {
      req
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', adminJar.get('cg_csrf') ?? '');
    }
    return req;
  };

  async function mine(name: string): Promise<MyFamily> {
    return body<MyFamily>(await as(name, 'get', '/families/mine').expect(200))
      .data!;
  }

  let fillers = 0;
  async function addFiller(count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let n = 0; n < count; n++) {
      const i = fillers++;
      const user = await prisma.user.create({
        data: {
          email: `family-filler-${i}-${stamp}@cabinguard.test`,
          passwordHash: 'not-used',
          role: 'DRIVER',
          status: 'ACTIVE',
          firstName: `Filler${i}`,
          lastName: 'Driver',
          profileCompletedAt: new Date(),
        },
      });
      createdIds.push(user.id);
      ids.push(user.id);
      await asAdmin('post', `/admin/families/${familyId}/members`)
        .send({ userId: user.id })
        .expect(201);
    }
    return ids;
  }

  // --- creation & invitation ------------------------------------------------

  it('creates a family with its creator as owner, once', async () => {
    const res = await as('amira', 'post', '/families')
      .send({ name: '  Ben Salah family ' })
      .expect(201);
    const family = body<MyFamily>(res).data!.family!;
    familyId = family.id;
    expect(family).toMatchObject({
      name: 'Ben Salah family',
      myRole: 'OWNER',
      pendingRequestCount: 0,
    });
    expect(family.members.map((m) => m.firstName)).toEqual(['Amira']);

    const again = await as('amira', 'post', '/families')
      .send({ name: 'Second' })
      .expect(409);
    expect(codeOf(again)).toBe('ALREADY_IN_FAMILY');
  });

  it('gives the owner a code and an https link to share', async () => {
    const res = await as('amira', 'get', '/families/mine/invite').expect(200);
    invite = body<Invite>(res).data!;
    expect(invite.code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    expect(invite.link).toBe(
      `http://localhost:3000/mobile/join-family#${invite.code}`,
    );
    // Asking again returns the same, still valid, code.
    const same = await as('amira', 'get', '/families/mine/invite').expect(200);
    expect(body<Invite>(same).data!.code).toBe(invite.code);
  });

  it('shows which family a code belongs to, however it is typed', async () => {
    const typed = invite.code.replace('-', '').toLowerCase();
    const res = await as('bilel', 'get', `/families/invites/${typed}`).expect(
      200,
    );
    expect(body(res).data).toEqual({
      familyName: 'Ben Salah family',
      ownerFirstName: 'Amira',
      memberCount: 1,
      maxMembers: 10,
      full: false,
    });
    const unknown = await as(
      'bilel',
      'get',
      '/families/invites/AAAA-BBBB',
    ).expect(404);
    expect(codeOf(unknown)).toBe('FAMILY_INVITE_INVALID');
  });

  // --- joining ---------------------------------------------------------------

  it('turns a code into a request that waits for the owner', async () => {
    await as('bilel', 'post', '/families/join')
      .send({ code: invite.code })
      .expect(200);
    const view = await mine('bilel');
    expect(view.family).toBeNull();
    expect(view.pendingRequest).toMatchObject({
      familyName: 'Ben Salah family',
      status: 'PENDING',
    });

    const twice = await as('bilel', 'post', '/families/join')
      .send({ code: invite.code })
      .expect(409);
    expect(codeOf(twice)).toBe('JOIN_REQUEST_ALREADY_PENDING');

    expect((await mine('amira')).family?.pendingRequestCount).toBe(1);
  });

  it('lets only the owner approve, then the driver is in', async () => {
    const requests = body<{ id: string; firstName: string }[]>(
      await as('amira', 'get', '/families/mine/join-requests').expect(200),
    ).data!;
    expect(requests.map((r) => r.firstName)).toEqual(['Bilel']);

    const stranger = await as(
      'chaima',
      'post',
      `/families/mine/join-requests/${requests[0].id}/approve`,
    ).expect(404);
    expect(codeOf(stranger)).toBe('NOT_IN_FAMILY');

    await as(
      'amira',
      'post',
      `/families/mine/join-requests/${requests[0].id}/approve`,
    ).expect(200);
    const bilel = await mine('bilel');
    expect(bilel.family?.myRole).toBe('MEMBER');
    expect(bilel.family?.pendingRequestCount).toBeNull();

    const notOwner = await as('bilel', 'get', '/families/mine/invite').expect(
      403,
    );
    expect(codeOf(notOwner)).toBe('FAMILY_OWNER_ONLY');
  });

  it('lets the owner decline, and the driver withdraw', async () => {
    await as('chaima', 'post', '/families/join')
      .send({ code: invite.code })
      .expect(200);
    const [req] = body<{ id: string }[]>(
      await as('amira', 'get', '/families/mine/join-requests').expect(200),
    ).data!;
    await as('amira', 'post', `/families/mine/join-requests/${req.id}/reject`)
      .send()
      .expect(200);
    expect((await mine('chaima')).pendingRequest).toBeNull();
    const decided = await as(
      'amira',
      'post',
      `/families/mine/join-requests/${req.id}/approve`,
    ).expect(422);
    expect(codeOf(decided)).toBe('JOIN_REQUEST_CLOSED');

    await as('chaima', 'post', '/families/join')
      .send({ code: invite.code })
      .expect(200);
    await as('chaima', 'delete', '/families/join-request').expect(200);
    expect((await mine('chaima')).pendingRequest).toBeNull();
  });

  it('stops accepting an old code once the owner replaces it', async () => {
    const res = await as('amira', 'post', '/families/mine/invite/rotate')
      .send()
      .expect(200);
    const fresh = body<Invite>(res).data!;
    expect(fresh.code).not.toBe(invite.code);
    await as('chaima', 'post', '/families/join')
      .send({ code: invite.code })
      .expect(404);
    invite = fresh;
  });

  // --- sharing ---------------------------------------------------------------

  it("only shows a member's phone once they consent, and stops when they withdraw", async () => {
    const before = (await mine('amira')).family!.members;
    const bilel = before.find((m) => m.firstName === 'Bilel')!;
    expect(bilel.phoneNumber).toBeNull();
    expect(bilel.sharing).toEqual({
      phone: false,
      incidents: false,
      health: false,
    });

    await as('bilel', 'put', '/families/mine/sharing')
      .send({ phone: true, health: true })
      .expect(200);
    const shared = (await mine('amira')).family!.members.find(
      (m) => m.firstName === 'Bilel',
    )!;
    expect(shared.phoneNumber).toBe('+21655123456');
    expect(shared.sharing).toEqual({
      phone: true,
      incidents: false,
      health: true,
    });
    const row = await prisma.familyMember.findUniqueOrThrow({
      where: { userId: drivers.bilel.id },
    });
    expect(row.sharePhoneAt).not.toBeNull();
    expect(row.shareHealthAt).not.toBeNull();
    expect(row.shareIncidentsAt).toBeNull();

    await as('bilel', 'put', '/families/mine/sharing')
      .send({ phone: false })
      .expect(200);
    const withdrawn = (await mine('amira')).family!.members.find(
      (m) => m.firstName === 'Bilel',
    )!;
    expect(withdrawn.phoneNumber).toBeNull();
    expect(withdrawn.sharing.health).toBe(true); // untouched flags stay
  });

  // --- capacity & concurrency ----------------------------------------------

  it('never goes over 10 members', async () => {
    await addFiller(7); // amira, bilel + 7 = 9
    await as('chaima', 'post', '/families/join')
      .send({ code: invite.code })
      .expect(200);
    await addFiller(1); // 10: chaima's request can no longer be approved
    const [req] = body<{ id: string }[]>(
      await as('amira', 'get', '/families/mine/join-requests').expect(200),
    ).data!;
    const full = await as(
      'amira',
      'post',
      `/families/mine/join-requests/${req.id}/approve`,
    ).expect(422);
    expect(codeOf(full)).toBe('FAMILY_FULL');
    // The request stays open so the owner can make room.
    expect((await mine('chaima')).pendingRequest?.status).toBe('PENDING');

    const another = await as('dali', 'post', '/families/join')
      .send({ code: invite.code })
      .expect(422);
    expect(codeOf(another)).toBe('FAMILY_FULL');
    await as('chaima', 'delete', '/families/join-request').expect(200);
  });

  it('keeps one family per driver even under concurrent requests', async () => {
    const results = await Promise.all([
      as('emna', 'post', '/families').send({ name: 'Race one' }),
      as('emna', 'post', '/families').send({ name: 'Race two' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.familyMember.count({ where: { userId: drivers.emna.id } }),
    ).toBe(1);
    // Emna leaves her one-person family: it is dissolved.
    await as('emna', 'post', '/families/mine/leave').send().expect(200);
    expect((await mine('emna')).family).toBeNull();
  });

  // --- ownership -------------------------------------------------------------

  it('hands ownership over explicitly, with exactly one owner at all times', async () => {
    const res = await as('amira', 'post', '/families/mine/owner')
      .send({ userId: drivers.bilel.id })
      .expect(200);
    expect(body<MyFamily>(res).data!.family!.myRole).toBe('MEMBER');
    expect((await mine('bilel')).family!.myRole).toBe('OWNER');
    expect(
      await prisma.familyMember.count({
        where: { familyId, role: 'OWNER' },
      }),
    ).toBe(1);
  });

  it('passes ownership to the longest-standing member when the owner leaves', async () => {
    await as('bilel', 'post', '/families/mine/leave').send().expect(200);
    expect((await mine('bilel')).family).toBeNull();
    // Amira joined first.
    expect((await mine('amira')).family!.myRole).toBe('OWNER');
    const transfer = await prisma.auditLog.findFirstOrThrow({
      where: {
        action: 'FAMILY_OWNERSHIP_TRANSFERRED',
        targetId: familyId,
        metadata: { path: ['automatic'], equals: true },
      },
    });
    expect(transfer.metadata).toMatchObject({ to: drivers.amira.id });
  });

  it('lets the owner remove members, but not themselves', async () => {
    const self = await as(
      'amira',
      'delete',
      `/families/mine/members/${drivers.amira.id}`,
    ).expect(422);
    expect(codeOf(self)).toBe('CANNOT_REMOVE_YOURSELF');

    const members = (await mine('amira')).family!.members;
    const filler = members.find((m) => m.role === 'MEMBER')!;
    const res = await as(
      'amira',
      'delete',
      `/families/mine/members/${filler.userId}`,
    ).expect(200);
    expect(body<MyFamily>(res).data!.family!.members).toHaveLength(
      members.length - 1,
    );
  });

  // --- account lifecycle -----------------------------------------------------

  it('detaches a suspended owner and gives the family a new owner', async () => {
    await asAdmin('post', `/admin/users/${drivers.amira.id}/suspend`)
      .send()
      .expect(200);
    expect(
      await prisma.familyMember.count({ where: { userId: drivers.amira.id } }),
    ).toBe(0);
    const owners = await prisma.familyMember.findMany({
      where: { familyId, role: 'OWNER' },
    });
    expect(owners).toHaveLength(1);
    await asAdmin('post', `/admin/users/${drivers.amira.id}/reactivate`)
      .send()
      .expect(200);
  });

  // --- console ---------------------------------------------------------------

  it('lets administrators find and inspect families, without shared data', async () => {
    const list = await asAdmin(
      'get',
      `/admin/families?search=Ben%20Salah&pageSize=5`,
    ).expect(200);
    const page = body<{ id: string; memberCount: number }[]>(list).data!;
    expect(page.map((f) => f.id)).toContain(familyId);

    const detail = await asAdmin('get', `/admin/families/${familyId}`).expect(
      200,
    );
    const view = body<{ members: Record<string, unknown>[] }>(detail).data!;
    expect(view.members.length).toBeGreaterThan(0);
    for (const member of view.members) {
      expect(member).not.toHaveProperty('phoneNumber');
      expect(member).not.toHaveProperty('sharing');
    }

    // Driver tokens cannot reach the console, and admins have no "mine".
    await as('dali', 'get', '/admin/families').expect(403);
    await asAdmin('get', '/families/mine').expect(403);
  });

  it('lets administrators add, promote and remove members, then dissolve', async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { email: `family-admin-${stamp}@cabinguard.test` },
    });
    const notDriver = await asAdmin(
      'post',
      `/admin/families/${familyId}/members`,
    )
      .send({ userId: admin.id })
      .expect(422);
    expect(codeOf(notDriver)).toBe('NOT_A_DRIVER');

    await asAdmin('post', `/admin/families/${familyId}/members`)
      .send({ userId: drivers.dali.id })
      .expect(201);
    const taken = await asAdmin('post', `/admin/families/${familyId}/members`)
      .send({ userId: drivers.dali.id })
      .expect(409);
    expect(codeOf(taken)).toBe('ALREADY_IN_FAMILY');

    await asAdmin('post', `/admin/families/${familyId}/owner`)
      .send({ userId: drivers.dali.id })
      .expect(201);
    expect((await mine('dali')).family!.myRole).toBe('OWNER');

    await asAdmin(
      'delete',
      `/admin/families/${familyId}/members/${drivers.dali.id}`,
    ).expect(200);
    expect((await mine('dali')).family).toBeNull();

    await asAdmin('delete', `/admin/families/${familyId}`).expect(200);
    await asAdmin('get', `/admin/families/${familyId}`).expect(404);
    expect(await prisma.familyMember.count({ where: { familyId } })).toBe(0);
  });
});
