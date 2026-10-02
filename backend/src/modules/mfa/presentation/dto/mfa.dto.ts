import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';
import {
  MFA_CODE_MESSAGE,
  MFA_CODE_PATTERN,
} from '../../../auth/presentation/dto/auth-request.dto';
import { AccountState } from '../../../users/domain/account-state';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Authenticator code or recovery code, for sensitive actions. */
export class MfaCodeDto {
  @ApiProperty({
    example: '123456',
    description: 'Authenticator or recovery code',
  })
  @Transform(trim)
  @IsString()
  @Matches(MFA_CODE_PATTERN, { message: `code ${MFA_CODE_MESSAGE}` })
  code!: string;
}

export class StartTotpSetupDto {
  @ApiPropertyOptional({
    example: '123456',
    description:
      'Only when replacing an active authenticator: a code from the current one, or a recovery code',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(MFA_CODE_PATTERN, { message: `code ${MFA_CODE_MESSAGE}` })
  code?: string;
}

/** The setup is confirmed with the NEW app's code (never a recovery code). */
export class ConfirmTotpSetupDto {
  @ApiProperty({ example: '123456' })
  @Transform(trim)
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'code must be the 6-digit code shown in the app',
  })
  code!: string;
}

export class MfaStatusResponse {
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ nullable: true, type: Date }) enabledAt!: Date | null;
  @ApiProperty({ description: 'Cannot be turned off for this account' })
  required!: boolean;
  @ApiProperty() recoveryCodesRemaining!: number;
  @ApiProperty({ description: 'Suggest regenerating recovery codes' })
  recoveryCodesLow!: boolean;
}

export class TotpSetupResponse {
  @ApiProperty({ description: 'Base32 key for manual entry' }) secret!: string;
  @ApiProperty({ description: 'Render as a QR code' }) otpauthUri!: string;
  @ApiProperty() issuer!: string;
  @ApiProperty() accountName!: string;
  @ApiProperty({ example: 'SHA1' }) algorithm!: string;
  @ApiProperty({ example: 6 }) digits!: number;
  @ApiProperty({ example: 30 }) period!: number;
  @ApiProperty({ type: Date, description: 'Confirm before this instant' })
  expiresAt!: Date;
}

export class RecoveryCodesResponse {
  @ApiProperty({
    type: [String],
    example: ['K7M4Q-X9PRT', '...'],
    description: 'Shown once: store them somewhere safe',
  })
  recoveryCodes!: string[];

  @ApiProperty({ enum: Object.values(AccountState) })
  accountState!: AccountState;
}
