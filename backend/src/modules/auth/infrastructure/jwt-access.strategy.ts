import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  authConfig,
  cookieConfig,
  type AuthConfig,
  type CookieConfig,
} from '../../../config';
import { readCookie } from '../../../common/http/request-context';
import { AccessTokenValidator } from '../application/access-token-validator';
import { isAccessTokenPayload } from '../domain/access-token-payload';
import type { AuthenticatedUser } from '../domain/authenticated-user';
import { SessionInvalidError } from '../domain/auth.errors';

export const JWT_ACCESS_STRATEGY = 'jwt-access';

/**
 * Reads the access token ONLY from the HttpOnly cookie (never from localStorage /
 * Authorization header), pins the algorithm, issuer and audience.
 */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  JWT_ACCESS_STRATEGY,
) {
  constructor(
    @Inject(authConfig.KEY) auth: AuthConfig,
    @Inject(cookieConfig.KEY) cookies: CookieConfig,
    private readonly validator: AccessTokenValidator,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => readCookie(req, cookies.names.accessToken) ?? null,
      ]),
      secretOrKey: auth.jwt.accessSecret,
      algorithms: [auth.jwt.algorithm],
      issuer: auth.jwt.issuer,
      audience: auth.jwt.audience,
      ignoreExpiration: false,
    });
  }

  validate(payload: unknown): Promise<AuthenticatedUser> {
    if (!isAccessTokenPayload(payload)) throw new SessionInvalidError();
    return this.validator.validate(payload);
  }
}
