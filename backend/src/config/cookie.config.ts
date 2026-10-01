import { ConfigType, registerAs } from '@nestjs/config';
import { API_BASE_PATH } from './api.constants';
import { readEnv } from './env.validation';

/**
 * Cookies are host-only (no Domain attribute) so the __Host- prefix can be used.
 * Prefixes require Secure, so they are only applied when COOKIE_SECURE=true
 * (always the case in production, enforced by env validation).
 */
export const cookieConfig = registerAs('cookie', () => {
  const env = readEnv();
  const secure = env.COOKIE_SECURE;
  return {
    secure,
    sameSite: env.COOKIE_SAME_SITE,
    names: {
      accessToken: secure ? '__Host-cg_at' : 'cg_at',
      // __Secure- (not __Host-) because the refresh cookie is path-scoped.
      refreshToken: secure ? '__Secure-cg_rt' : 'cg_rt',
      csrf: secure ? '__Host-cg_csrf' : 'cg_csrf',
    },
    // The refresh token is only ever sent to the auth endpoints.
    refreshTokenPath: `${API_BASE_PATH}/auth`,
  };
});

export type CookieConfig = ConfigType<typeof cookieConfig>;
