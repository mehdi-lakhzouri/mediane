import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  appConfig,
  cookieConfig,
  type AppConfig,
  type CookieConfig,
} from '../../../config';
import { readCookie } from '../../../common/http/request-context';
import { CsrfTokenService } from '../infrastructure/csrf-token.service';
import { CSRF_HEADER, SKIP_CSRF_KEY } from './csrf.constants';
import { CsrfValidationError } from './csrf.errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global guard, runs BEFORE authentication for every state-changing request
 * (including pre-auth ones like login, to prevent login CSRF). Layers:
 *   1. SameSite cookies (browser side, configured in cookie.config)
 *   2. Origin / Referer must belong to the CORS allow-list when present
 *   3. Signed double-submit token: X-CSRF-Token header === CSRF cookie
 * Safe methods are never checked, so GET handlers must never mutate state.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly trustedOrigins: ReadonlySet<string>;

  constructor(
    private readonly reflector: Reflector,
    private readonly csrfTokens: CsrfTokenService,
    @Inject(appConfig.KEY) app: AppConfig,
    @Inject(cookieConfig.KEY) private readonly cookies: CookieConfig,
  ) {
    this.trustedOrigins = new Set(app.corsOrigins);
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean | undefined>(
      SKIP_CSRF_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    this.assertTrustedOrigin(req);

    const cookieToken = readCookie(req, this.cookies.names.csrf);
    const headerToken = req.get(CSRF_HEADER);
    if (
      !cookieToken ||
      !headerToken ||
      !this.csrfTokens.verify(cookieToken, headerToken)
    ) {
      throw new CsrfValidationError();
    }
    return true;
  }

  private assertTrustedOrigin(req: Request): void {
    const origin = req.get('origin');
    if (origin !== undefined) {
      if (!this.trustedOrigins.has(origin)) throw new CsrfValidationError();
      return;
    }
    const referer = req.get('referer');
    if (referer !== undefined) {
      const refererOrigin = URL.parse(referer)?.origin;
      if (!refererOrigin || !this.trustedOrigins.has(refererOrigin)) {
        throw new CsrfValidationError();
      }
    }
    // Neither header: not a modern browser request. The double-submit token still applies.
  }
}
