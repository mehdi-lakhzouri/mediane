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
