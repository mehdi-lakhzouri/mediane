import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../../security/domain/password-policy';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class LoginDto {
  @ApiProperty({ example: 'driver@example.com', maxLength: 254 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // No policy check at login (only a max length to bound Argon2 work).
  @ApiProperty({ format: 'password', maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiPropertyOptional({
    default: true,
    description: 'false => cookies are dropped when the browser closes',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

/** 6-digit authenticator code, or a recovery code (XXXXX-XXXXX). */
export const MFA_CODE_PATTERN = /^(\d{6}|[A-Za-z0-9]{5}[\s-]?[A-Za-z0-9]{5})$/;
export const MFA_CODE_MESSAGE =
  'must be a 6-digit code from the authenticator app or a recovery code';

export class MfaChallengeDto {
  @ApiProperty({ description: 'mfaToken returned by the login' })
  @IsString()
  @Length(32, 128)
  mfaToken!: string;

  @ApiProperty({
    example: '123456',
    description: 'Authenticator or recovery code',
  })
  @Transform(trim)
  @IsString()
  @Matches(MFA_CODE_PATTERN, { message: `code ${MFA_CODE_MESSAGE}` })
  code!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  currentPassword!: string;

  @ApiProperty({
    format: 'password',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  newPassword!: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Required when two-step verification is enabled',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(MFA_CODE_PATTERN, { message: `mfaCode ${MFA_CODE_MESSAGE}` })
  mfaCode?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'driver@example.com' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token received by email' })
  @IsString()
  @Length(32, 256)
  token!: string;

  @ApiProperty({
    format: 'password',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  newPassword!: string;
}
