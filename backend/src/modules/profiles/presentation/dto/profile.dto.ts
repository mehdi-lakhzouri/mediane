import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AccountState } from '../../../users/domain/account-state';
import {
  EmergencyContactRelationship,
  Gender,
} from '../../domain/emergency-contact';
import {
  MAX_EMERGENCY_CONTACTS,
  MIN_EMERGENCY_CONTACTS,
} from '../../domain/profile-rules';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Spaces, dashes, dots and brackets are tolerated on input, then removed. */
const normalizePhone = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/[\s\-.()]/g, '') : value;

// E.164 international format, e.g. +21612345678
const E164 = /^\+[1-9]\d{6,14}$/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

const GENDERS = Object.values(Gender);
const RELATIONSHIPS = Object.values(EmergencyContactRelationship);

export class EmergencyContactDto {
  @ApiProperty({ example: 'Amira Ben Salah', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @ApiProperty({ enum: RELATIONSHIPS, example: 'SPOUSE' })
  @IsIn(RELATIONSHIPS)
  relationship!: EmergencyContactRelationship;

  @ApiProperty({ example: '+21698765432' })
  @Transform(normalizePhone)
  @IsString()
  @Matches(E164, { message: 'phoneNumber must be in E.164 format' })
  phoneNumber!: string;
}

/** Full replacement: send every field, and the complete contact list in priority order. */
export class SaveProfileDto {
  @ApiProperty({ example: '+21612345678' })
  @Transform(normalizePhone)
  @IsString()
  @Matches(E164, { message: 'phoneNumber must be in E.164 format' })
  phoneNumber!: string;

  @ApiProperty({ example: '1990-05-17', format: 'date' })
  @IsString()
  @Matches(CALENDAR_DATE, { message: 'dateOfBirth must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  dateOfBirth!: string;

  @ApiProperty({ enum: GENDERS })
  @IsIn(GENDERS)
  gender!: Gender;

  @ApiProperty({
    type: [EmergencyContactDto],
    minItems: MIN_EMERGENCY_CONTACTS,
    maxItems: MAX_EMERGENCY_CONTACTS,
    description: 'Priority order: the first contact is called first.',
  })
  @IsArray()
  @ArrayMinSize(MIN_EMERGENCY_CONTACTS)
  @ArrayMaxSize(MAX_EMERGENCY_CONTACTS)
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergencyContacts!: EmergencyContactDto[];
}

export class EmergencyContactResponse {
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: RELATIONSHIPS }) relationship!: string;
  @ApiProperty() phoneNumber!: string;
  @ApiProperty({ description: '1 = called first' }) priority!: number;
}

export class AvatarResponse {
  @ApiProperty({ description: 'Signed URL, load it directly; expires soon' })
  url!: string;

  @ApiProperty({ type: Date }) expiresAt!: Date;
}

export class ProfileResponse {
  @ApiProperty({ nullable: true, type: String }) phoneNumber!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date' })
  dateOfBirth!: string | null;
  @ApiProperty({ nullable: true, enum: GENDERS }) gender!: Gender | null;
  @ApiProperty({ type: [EmergencyContactResponse] })
  emergencyContacts!: EmergencyContactResponse[];
  @ApiProperty({ nullable: true, type: AvatarResponse })
  avatar!: AvatarResponse | null;
  @ApiProperty({ nullable: true, type: Date }) completedAt!: Date | null;
  @ApiProperty({ enum: Object.values(AccountState) })
  accountState!: AccountState;
}

/** Swagger only: the multipart body of the avatar upload. */
export class AvatarUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'JPEG, PNG or WebP, at most 5 MB, at least 128×128 px',
  })
  avatar!: unknown;
}
