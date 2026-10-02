import { ConfigType, registerAs } from '@nestjs/config';
import { readEnv } from './env.validation';

export const mfaConfig = registerAs('mfa', () => {
  const env = readEnv();
  return {
    encryptionKey: Buffer.from(env.MFA_ENCRYPTION_KEY, 'base64'),
    issuer: env.MFA_ISSUER,
    /** A started setup must be confirmed within this delay. */
    setupTtlSeconds: 15 * 60,
    /** Password verified, code pending: the login challenge lifetime. */
    challengeTtlSeconds: 5 * 60,
    challengeMaxAttempts: 5,
  };
});

export type MfaConfig = ConfigType<typeof mfaConfig>;
