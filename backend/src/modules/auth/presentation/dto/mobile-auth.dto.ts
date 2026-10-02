import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { SessionPrincipalResponse } from './auth-response.dto';

/** base64url of 32 random bytes = 43 chars; a little slack, but bounded. */
const REFRESH_TOKEN_LENGTH = { min: 32, max: 128 } as const;

export class MobileRefreshDto {
  @ApiProperty({ description: 'Refresh token stored in the device keystore' })
  @IsString()
  @Length(REFRESH_TOKEN_LENGTH.min, REFRESH_TOKEN_LENGTH.max)
  refreshToken!: string;
}

/**
 * Mobile counterpart of the web cookies. The app keeps the refresh token in the
 * platform keystore (Keychain / Android Keystore) and the access token in
 * memory only; both are rotated on every refresh.
 */
export class MobileSessionResponse extends SessionPrincipalResponse {
  @ApiProperty({ enum: ['Bearer'] })
  tokenType!: 'Bearer';

  @ApiProperty({ description: 'Send as `Authorization: Bearer <token>`' })
  accessToken!: string;

  @ApiProperty({ type: Date })
  accessTokenExpiresAt!: Date;

  @ApiProperty({
    description:
      'Single use: each refresh returns a new one. Replaying an old one revokes the session.',
  })
  refreshToken!: string;

  @ApiProperty({ type: Date })
  refreshTokenExpiresAt!: Date;
}
