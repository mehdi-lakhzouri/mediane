import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/http/dto/pagination-query.dto';
import {
  type DeviceRecord,
  DevicePolicy,
  DeviceStatus,
} from '../../domain/device';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const STATUSES = Object.values(DeviceStatus);

export class RegisterDeviceDto {
  @ApiProperty({
    example: 'CG-0001-A7',
    maxLength: DevicePolicy.SERIAL_MAX_LENGTH,
    description: 'Letters, digits, dots, dashes and underscores.',
  })
  @Transform(trim)
  @IsString()
  @Matches(/^[A-Za-z0-9._-]+$/)
  @MaxLength(DevicePolicy.SERIAL_MAX_LENGTH)
  serialNumber!: string;

  @ApiProperty({
    example: 'Truck 12 cabin unit',
    maxLength: DevicePolicy.LABEL_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(DevicePolicy.LABEL_MAX_LENGTH)
  label!: string;
}

export class PairDeviceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}

export class ListDevicesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Serial number or label' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: DeviceStatus;
}

export class DeviceHeartbeatDto {
  @ApiPropertyOptional({ example: '1.4.2', maxLength: 32 })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9.+_-]{1,32}$/)
  firmwareVersion?: string;
}

class PairedDriverResponse {
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
}

export class DeviceResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() serialNumber!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: STATUSES }) status!: DeviceStatus;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  pairedUserId!: string | null;
  @ApiProperty({ type: PairedDriverResponse, nullable: true })
  pairedDriver!: PairedDriverResponse | null;
  @ApiProperty({ type: Date, nullable: true }) pairedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true })
  firmwareVersion!: string | null;
  @ApiProperty({ type: Date, nullable: true }) lastSeenAt!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) secretRotatedAt!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) revokedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class DeviceWithSecretResponse {
  @ApiProperty({ type: DeviceResponse }) device!: DeviceRecord;

  @ApiProperty({
    description:
      'Signing secret (base64url). Shown once: load it into the unit now.',
  })
  secret!: string;
}
