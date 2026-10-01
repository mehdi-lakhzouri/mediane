import { ConfigType, registerAs } from '@nestjs/config';
import { readEnv } from './env.validation';

export const authConfig = registerAs('auth', () => {
  const env = readEnv();
  return {
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      algorithm: 'HS256' as const,
    },
    refreshSession: {
      idleTtlSeconds: env.REFRESH_SESSION_IDLE_TTL_SECONDS,
      absoluteTtlSeconds: env.REFRESH_SESSION_ABSOLUTE_TTL_SECONDS,
    },
    tokenHashSecret: env.TOKEN_HASH_SECRET,
    invitationTtlSeconds: env.INVITATION_TTL_SECONDS,
    // A temporary password never outlives the invitation that delivered it.
    temporaryPasswordTtlSeconds: env.INVITATION_TTL_SECONDS,
    passwordResetTtlSeconds: env.PASSWORD_RESET_TTL_SECONDS,
  };
});

export type AuthConfig = ConfigType<typeof authConfig>;
