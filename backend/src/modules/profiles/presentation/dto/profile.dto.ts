import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// E.164 international format, e.g. +21612345678
const E164 = /^\+[1-9]\d{6,14}$/;

export class SaveProfileDto {
  @ApiProperty({ example: '+21612345678' })
  @Transform(trim)
  @Matches(E164, { message: 'phoneNumber must be in E.164 format' })
  phoneNumber!: string;

  @ApiProperty({ example: '1990-05-17', format: 'date' })
  @IsISO8601({ strict: true, strictSeparator: true })
  dateOfBirth!: string;

  @ApiProperty({ maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  emergencyContactName!: string;

  @ApiProperty({ example: '+21698765432' })
  @Transform(trim)
  @Matches(E164, { message: 'emergencyContactPhone must be in E.164 format' })
  emergencyContactPhone!: string;
}

export class ProfileResponse {
  @ApiProperty() phoneNumber!: string;
  @ApiProperty({ format: 'date' }) dateOfBirth!: string;
  @ApiProperty() emergencyContactName!: string;
  @ApiProperty() emergencyContactPhone!: string;
  @ApiProperty({ nullable: true, type: Date }) completedAt!: Date | null;
}
