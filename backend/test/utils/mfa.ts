import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { generateTotpSecret, totpAt } from '../../src/modules/mfa/domain/totp';
import { MfaSecretCipher } from '../../src/modules/mfa/infrastructure/mfa-secret.cipher';
import { CookieJar } from './cookie-jar';

const API = '/api/v1';
const ORIGIN = 'http://localhost:3000';
const CSRF_COOKIE = 'cg_csrf';

/**
 * Gives a test user a confirmed authenticator directly in the database and
 * returns its secret, so tests can compute valid codes with `codeFor`.
 */
export async function enrollTotp(
  app: INestApplication,
  prisma: PrismaService,
  userId: string,
): Promise<Buffer> {
  const secret = generateTotpSecret();
  await prisma.userMfa.create({
    data: {
      userId,
      totpSecretEnc: app.get(MfaSecretCipher).encrypt(secret, userId),
    },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabledAt: new Date() },
  });
  return secret;
}

/**
 * A code is never accepted twice (replay protection), and tests sign in many
 * times within one 30-second step: forget the last used step first.
 */
export async function freshCode(
  prisma: PrismaService,
  userId: string,
  secret: Buffer,
): Promise<string> {
  await prisma.userMfa.update({
    where: { userId },
    data: { totpLastUsedStep: null },
  });
  return totpAt(secret, new Date());
}

/** Full web sign-in of a user with MFA: password, then code. Returns the cookie jar. */
export async function webLoginWithMfa(
  server: App,
  prisma: PrismaService,
  user: { id: string; email: string; password: string; secret: Buffer },
): Promise<CookieJar> {
  const jar = new CookieJar().absorb(
    await request(server).get(`${API}/auth/csrf`).expect(200),
  );
  const post = (path: string, body: object) =>
    request(server)
      .post(`${API}${path}`)
      .set('Origin', ORIGIN)
      .set('Cookie', jar.header())
      .set('X-CSRF-Token', jar.get(CSRF_COOKIE) ?? '')
      .send(body);

  const login = await post('/auth/login', {
    email: user.email,
    password: user.password,
  }).expect(200);
  const { mfaToken } = (login.body as { data: { mfaToken: string } }).data;
  jar.absorb(
    await post('/auth/mfa/challenge', {
      mfaToken,
      code: await freshCode(prisma, user.id, user.secret),
    }).expect(200),
  );
  return jar;
}
