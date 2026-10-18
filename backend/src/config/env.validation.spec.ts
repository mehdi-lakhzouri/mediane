import { validateEnv } from './env.validation';

/** A complete, valid production configuration (S3 storage). */
const production = (): Record<string, string> => ({
  NODE_ENV: 'production',
  CORS_ORIGINS: 'https://app.example.com',
  FRONTEND_URL: 'https://app.example.com',
  COOKIE_SECURE: 'true',
  SWAGGER_ENABLED: 'false',
  DATABASE_URL: 'postgresql://user:pass@db:5432/app',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  TOKEN_HASH_SECRET: 'b'.repeat(40),
  MFA_ENCRYPTION_KEY: 'dGVzdC1tZmEta2V5LW9mLWV4YWN0bHktMzItYnl0ZXM=',
  MAIL_HOST: 'smtp.example.com',
  MAIL_FROM: 'App <no-reply@example.com>',
  STORAGE_DRIVER: 's3',
  S3_BUCKET: 'avatars',
  S3_REGION: 'auto',
});

describe('validateEnv in production', () => {
  it('accepts S3 storage', () => {
    expect(() => validateEnv(production())).not.toThrow();
  });

  it('refuses local storage by default', () => {
    expect(() =>
      validateEnv({ ...production(), STORAGE_DRIVER: 'local' }),
    ).toThrow(/STORAGE_DRIVER must be s3 in production/);
  });

  it('accepts local storage when a single server opts in explicitly', () => {
    expect(() =>
      validateEnv({
        ...production(),
        STORAGE_DRIVER: 'local',
        STORAGE_LOCAL_IN_PRODUCTION: 'true',
      }),
    ).not.toThrow();
  });

  it('keeps every other production guard with the opt-in', () => {
    expect(() =>
      validateEnv({
        ...production(),
        STORAGE_DRIVER: 'local',
        STORAGE_LOCAL_IN_PRODUCTION: 'true',
        COOKIE_SECURE: 'false',
      }),
    ).toThrow(/COOKIE_SECURE must be true in production/);
  });
});
