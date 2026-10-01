import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { authConfig, type AuthConfig } from '../../../config';
import type { AccessTokenPayload } from '../domain/access-token-payload';

/** Signs short-lived access JWTs (algorithm, issuer, audience, TTL from JwtModule config). */
@Injectable()
export class AccessTokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfig,
  ) {}

  issue(
    userId: string,
    sessionId: string,
    now: Date,
  ): { token: string; expiresAt: Date } {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId };
    return {
      token: this.jwt.sign(payload),
      expiresAt: new Date(
        now.getTime() + this.auth.jwt.accessTtlSeconds * 1000,
      ),
    };
  }
}
