import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import {
  authConfig,
  cookieConfig,
  type AuthConfig,
  type CookieConfig,
} from '../../../config';
import { AccessTokenValidator } from '../application/access-token-validator';
import { isAccessTokenPayload } from '../domain/access-token-payload';
import type { AuthenticatedUser } from '../domain/authenticated-user';
import { SessionInvalidError } from '../domain/auth.errors';
import { readAccessToken } from './access-token-transport';

export const JWT_ACCESS_STRATEGY = 'jwt-access';

/**
 * Reads the access token from the HttpOnly cookie (web console) or from the
 * `Authorization: Bearer` header (mobile app) — never from a query string.
 * The transport decides which session channel is acceptable: a mobile token
 * replayed as a cookie, or a web token sent as Bearer, is rejected.
 */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  JWT_ACCESS_STRATEGY,
) {
  constructor(
    @Inject(authConfig.KEY) auth: AuthConfig,
    @Inject(cookieConfig.KEY) private readonly cookies: CookieConfig,
    private readonly validator: AccessTokenValidator,
  ) {
    super({
      jwtFromRequest: (req: Request) =>
        readAccessToken(req, cookies.names.accessToken)?.token ?? null,
      secretOrKey: auth.jwt.accessSecret,
      algorithms: [auth.jwt.algorithm],
      issuer: auth.jwt.issuer,
      audience: auth.jwt.audience,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: unknown): Promise<AuthenticatedUser> {
    const presented = readAccessToken(req, this.cookies.names.accessToken);
    if (!presented || !isAccessTokenPayload(payload)) {
      throw new SessionInvalidError();
    }
    return this.validator.validate(payload, presented.channel);
  }
}
