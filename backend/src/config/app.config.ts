import { ConfigType, registerAs } from '@nestjs/config';
import { NodeEnv, readEnv } from './env.validation';

export const appConfig = registerAs('app', () => {
  const env = readEnv();
  const isProduction = env.NODE_ENV === NodeEnv.Production;
  const mobileLinkUrl = (
    env.MOBILE_LINK_URL ?? `${env.FRONTEND_URL}/mobile`
  ).replace(/\/+$/, '');
  return {
    name: 'Mediane API',
    nodeEnv: env.NODE_ENV,
    isProduction,
    /** Background jobs stay off; tests drive them explicitly. */
    isTest: env.NODE_ENV === NodeEnv.Test,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigins: env.CORS_ORIGINS,
    frontendUrl: env.FRONTEND_URL,
    /** Links for the driver app: opened by the app, or handed over to it. */
    mobileLinkUrl,
    familyInviteUrl: (
      env.FAMILY_INVITE_URL ?? `${mobileLinkUrl}/join-family`
    ).replace(/\/+$/, ''),
    trustProxy: env.TRUST_PROXY,
    // Hard rule: never exposed in production, even if misconfigured.
    swaggerEnabled: env.SWAGGER_ENABLED && !isProduction,
    bodyLimit: '100kb',
  };
});

export type AppConfig = ConfigType<typeof appConfig>;
