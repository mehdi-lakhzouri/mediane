import type { Request } from 'express';
import { readCookie } from '../../../common/http/request-context';
import { SessionChannel } from '../../sessions/domain/refresh-session';

export interface PresentedAccessToken {
  token: string;
  /** Derived from HOW the token was sent, then matched against the session's own channel. */
  channel: SessionChannel;
}

// Compact JWS: three base64url segments.
const BEARER = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/;

/**
 * Web console: HttpOnly cookie. Mobile app: `Authorization: Bearer`.
 * The cookie wins when both are present, so a browser session is always
 * validated as a WEB session.
 */
export function readAccessToken(
  req: Request,
  cookieName: string,
): PresentedAccessToken | null {
  const cookie = readCookie(req, cookieName);
  if (cookie) return { token: cookie, channel: SessionChannel.WEB };

  const bearer = BEARER.exec(req.get('authorization') ?? '');
  return bearer ? { token: bearer[1], channel: SessionChannel.MOBILE } : null;
}
