import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';

/**
 * HTTP contract tests: envelope, CSRF, guards, validation.
 * None of these requests reach the database, but the app still needs a
 * reachable PostgreSQL at startup (DATABASE_URL / TEST_DATABASE_URL).
 */
describe('HTTP contract (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  const csrf = async (): Promise<{ token: string; cookie: string }> => {
    const res = await request(server).get('/api/v1/auth/csrf').expect(200);
    const body = res.body as { data: { csrfToken: string } };
    const cookies = res.get('Set-Cookie') ?? [];
    return { token: body.data.csrfToken, cookie: cookies[0].split(';')[0] };
  };

  it('wraps unknown routes in the error envelope', async () => {
    const res = await request(server).get('/api/v1/does-not-exist').expect(404);
    expect(res.body).toEqual({
      data: null,
      meta: { requestId: expect.any(String), timestamp: expect.any(String) },
      error: { code: 'NOT_FOUND', message: expect.any(String) },
    });
    expect(res.get('X-Request-Id')).toBe(
      (res.body as { meta: { requestId: string } }).meta.requestId,
    );
  });

  it('rejects unauthenticated access to protected routes', async () => {
    const res = await request(server).get('/api/v1/auth/me').expect(401);
    expect(res.body).toMatchObject({
      data: null,
      error: { code: 'AUTHENTICATION_REQUIRED' },
    });
  });

  it('rejects state-changing requests without a CSRF token', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.io', password: 'x' })
      .expect(403);
    expect(res.body).toMatchObject({
      error: { code: 'CSRF_VALIDATION_FAILED' },
    });
  });

  it('rejects untrusted origins even with a valid CSRF token', async () => {
    const { token, cookie } = await csrf();
    await request(server)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', token)
      .send({ email: 'a@b.io', password: 'x' })
      .expect(403);
  });

  it('rejects unknown body properties with field details', async () => {
    const { token, cookie } = await csrf();
    const res = await request(server)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', token)
      .send({ email: 'not-an-email', password: 'x', role: 'ADMIN' })
      .expect(400);
    expect(res.body).toMatchObject({
      data: null,
      error: {
        code: 'VALIDATION_FAILED',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'email' }),
          expect.objectContaining({ field: 'role' }),
        ]),
      },
    });
  });

  it('rate-limits login attempts per client (5 per minute)', async () => {
    const { token, cookie } = await csrf();
    const attempt = () =>
      request(server)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', token)
        .send({ email: 'nobody@cabinguard.test', password: 'wrong-password' });

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await attempt()).status);
    const last = await attempt().expect(429);
    expect(statuses).toContain(401);
    expect(last.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });

  it('protects admin routes', async () => {
    await request(server).get('/api/v1/admin/users').expect(401);
  });
});
