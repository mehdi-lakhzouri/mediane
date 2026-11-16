import { AppError, ErrorKind } from '../../../common/errors';
import { SessionChannel } from '../../sessions/domain/refresh-session';
import { Role } from '../../users/domain/role';

/**
 * Each role has exactly one client: administrators work in the web console,
 * drivers in the mobile app. Enforced at login, on refresh and on every
 * authenticated request, so a role change takes effect immediately.
 */
export function channelForRole(role: Role): SessionChannel {
  return role === Role.ADMIN ? SessionChannel.WEB : SessionChannel.MOBILE;
}

const CODES: Record<SessionChannel, string> = {
  [SessionChannel.WEB]: 'USE_WEB_CONSOLE',
  [SessionChannel.MOBILE]: 'USE_MOBILE_APP',
};

const MESSAGES: Record<SessionChannel, string> = {
  [SessionChannel.WEB]: 'Administrator accounts sign in on the web console.',
  [SessionChannel.MOBILE]:
    'Driver accounts sign in with the Mediane mobile app.',
};

/**
 * Only raised AFTER a correct password (like TemporaryPasswordExpiredError),
 * so naming the right client reveals nothing to someone without the password.
 */
export class WrongClientError extends AppError {
  readonly kind = ErrorKind.FORBIDDEN;

  constructor(expected: SessionChannel) {
    super(CODES[expected], MESSAGES[expected]);
  }
}
