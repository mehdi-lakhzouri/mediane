import { ApiProperty } from '@nestjs/swagger';
import { AccountState } from '../../../users/domain/account-state';
import { Role } from '../../../users/domain/role';

export class CsrfTokenResponse {
  @ApiProperty({ description: 'Send it back in the X-CSRF-Token header' })
  csrfToken!: string;
}

/** Never contains access/refresh tokens: they only travel in HttpOnly cookies. */
export class SessionPrincipalResponse {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: Object.values(Role) })
  role!: Role;

  @ApiProperty({ enum: Object.values(AccountState) })
  accountState!: AccountState;
}

/** Returned when a session is (re)created: carries the rotated CSRF token. */
export class SessionOpenedResponse extends SessionPrincipalResponse {
  @ApiProperty({ description: 'New CSRF token, send it in X-CSRF-Token' })
  csrfToken!: string;
}

/**
 * The caller's own identity. Only ever describes the authenticated user, so the
 * email is theirs to see; it is never returned for anyone else here.
 */
export class CurrentUserResponse extends SessionPrincipalResponse {
  @ApiProperty({ example: 'driver@example.com' })
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;
}

/** Web login, no second factor needed: cookies are set. */
export class WebSessionLoginResponse extends SessionOpenedResponse {
  @ApiProperty({ enum: [false] })
  mfaRequired!: false;
}

/**
 * Password accepted, second factor required: no session yet. Send the token
 * back with a code to the MFA challenge endpoint of the same client.
 */
export class MfaChallengeResponse {
  @ApiProperty({ enum: [true] })
  mfaRequired!: true;

  @ApiProperty({ description: 'Single use, expires in a few minutes' })
  mfaToken!: string;

  @ApiProperty({ type: Date })
  expiresAt!: Date;
}
