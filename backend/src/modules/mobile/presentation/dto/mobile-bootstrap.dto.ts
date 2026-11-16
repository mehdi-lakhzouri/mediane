import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MobileFeatureFlagsResponse {
  @ApiProperty({ example: false }) selfRegistration!: boolean;
  @ApiProperty({ example: true }) biometricUnlock!: boolean;
  @ApiProperty({ example: true }) familyJoin!: boolean;
}

export class MobileProfileRulesResponse {
  @ApiProperty({ example: 18 }) driverMinimumAge!: number;
  @ApiProperty({ example: 1 }) minEmergencyContacts!: number;
  @ApiProperty({ example: 20 }) maxEmergencyContacts!: number;
  @ApiProperty({ example: 5242880 }) avatarMaxBytes!: number;
  @ApiProperty({ example: 128 }) avatarMinSidePx!: number;
}

export class MobileBootstrapResponse {
  @ApiProperty({ example: '1.0.0' }) minimumSupportedVersion!: string;
  @ApiProperty({ example: '1.0.0' }) latestVersion!: string;
  @ApiProperty({ example: false }) maintenance!: boolean;
  @ApiProperty({
    example: 'Mediane is receiving a safety update. Please try again shortly.',
  })
  maintenanceMessage!: string;
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
  })
  maintenanceEndsAt!: string | null;
  @ApiProperty({ example: '2026-10-01' }) termsVersion!: string;
  @ApiProperty({ example: '2026-10-01' }) privacyVersion!: string;
  @ApiProperty({ example: 'https://cabinguard.app/terms' }) termsUrl!: string;
  @ApiProperty({ example: 'https://cabinguard.app/privacy' })
  privacyUrl!: string;
  @ApiProperty({ example: 'https://cabinguard.app/support' })
  supportUrl!: string;
  @ApiProperty({ type: MobileFeatureFlagsResponse })
  features!: MobileFeatureFlagsResponse;
  @ApiProperty({ type: MobileProfileRulesResponse })
  profileRules!: MobileProfileRulesResponse;
}
