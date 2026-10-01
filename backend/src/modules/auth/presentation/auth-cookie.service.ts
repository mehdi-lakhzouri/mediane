import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { cookieConfig, type CookieConfig } from '../../../config';
import { readCookie } from '../../../common/http/request-context';
import { CsrfTokenService } from '../../security/infrastructure/csrf-token.service';
import type { IssuedTokens } from '../application/auth.service';

/**
 * The only place that knows cookie names and attributes.
 *  - access token: HttpOnly, Secure, SameSite, Path=/
 *  - refresh token: HttpOnly, Secure, SameSite=Strict, Path=/api/v1/auth (never sent elsewhere)
 *  - CSRF token: readable by JS on purpose (double-submit), carries no authority by itself
 */
@Injectable()
export class AuthCookieService {
  constructor(
    @Inject(cookieConfig.KEY) private readonly config: CookieConfig,
    private readonly csrfTokens: CsrfTokenService,
  ) {}

  readRefreshToken(req: Request): string | undefined {
    return readCookie(req, this.config.names.refreshToken);
  }

  /**
   * Sets access + refresh cookies and rotates the CSRF token (new session =>
   * new CSRF token). Returns that CSRF token: the SPA may run on another origin
   * and then cannot read the cookie, so it also gets it in the response body.
   * Non-persistent sessions ("Keep me signed in" unchecked) get browser-session
   * cookies; the server-side expiry still applies.
   */
  setSessionCookies(res: Response, tokens: IssuedTokens): string {
    res.cookie(this.config.names.accessToken, tokens.accessToken, {
      ...this.baseOptions(true),
      ...(tokens.persistent ? { expires: tokens.accessTokenExpiresAt } : {}),
    });
    res.cookie(this.config.names.refreshToken, tokens.refreshToken, {
      ...this.baseOptions(true),
      sameSite: 'strict',
      path: this.config.refreshTokenPath,
      ...(tokens.persistent ? { expires: tokens.refreshTokenExpiresAt } : {}),
    });
    return this.issueCsrfToken(res);
  }

  clearSessionCookies(res: Response): void {
    res.clearCookie(this.config.names.accessToken, this.baseOptions(true));
    res.clearCookie(this.config.names.refreshToken, {
      ...this.baseOptions(true),
      sameSite: 'strict',
      path: this.config.refreshTokenPath,
    });
  }

  issueCsrfToken(res: Response): string {
    const token = this.csrfTokens.issue();
    res.cookie(this.config.names.csrf, token, this.baseOptions(false));
    return token;
  }

  private baseOptions(httpOnly: boolean): CookieOptions {
    return {
      httpOnly,
      secure: this.config.secure,
      sameSite: this.config.sameSite,
      path: '/',
    };
  }
}
