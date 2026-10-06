import { ConfigType, registerAs } from '@nestjs/config';
import { NodeEnv, readEnv } from './env.validation';

export const appConfig = registerAs('app', () => {
  const env = readEnv();
  const isProduction = env.NODE_ENV === NodeEnv.Production;
  return {
    name: 'CabinGuard API',
    nodeEnv: env.NODE_ENV,
    isProduction,
    /** Background jobs stay off; tests drive them explicitly. */
    isTest: env.NODE_ENV === NodeEnv.Test,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigins: env.CORS_ORIGINS,
    frontendUrl: env.FRONTEND_URL,
    familyInviteUrl: (
      env.FAMILY_INVITE_URL ?? `${env.FRONTEND_URL}/join-family`
    ).replace(/\/+$/, ''),
    trustProxy: env.TRUST_PROXY,
    // Hard rule: never exposed in production, even if misconfigured.
    swaggerEnabled: env.SWAGGER_ENABLED && !isProduction,
    bodyLimit: '100kb',
  };
});

export type AppConfig = ConfigType<typeof appConfig>;
