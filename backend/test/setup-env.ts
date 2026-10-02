import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Deterministic test configuration (loaded before any module reads the env).
Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  CORS_ORIGINS: 'http://localhost:3000',
  FRONTEND_URL: 'http://localhost:3000',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    'postgresql://cabinguard:cabinguard@127.0.0.1:5432/cabinguard_test',
  JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters',
  TOKEN_HASH_SECRET: 'test-token-hash-secret-with-at-least-32-chars',
  COOKIE_SECURE: 'false',
  MAIL_HOST: 'localhost',
  MAIL_PORT: '1025',
  MAIL_FROM: 'CabinGuard <no-reply@cabinguard.test>',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: join(tmpdir(), `cabinguard-e2e-uploads-${process.pid}`),
  API_PUBLIC_URL: 'http://api.cabinguard.test',
});
