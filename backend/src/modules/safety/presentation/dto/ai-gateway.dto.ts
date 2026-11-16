import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DETECTOR_STATUSES,
  type DetectorStatus,
} from '../../../devices/domain/runtime-health';
import { DeviceEventDto } from './safety-input.dto';

export class AiProvenanceDto {
  @ApiProperty({ enum: [1] }) @Equals(1) schemaVersion!: 1;
  @ApiProperty({ format: 'uuid' }) @IsUUID() associationId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() episodeId!: string;
  @ApiProperty({ enum: ['REPLAY', 'SENSOR'] })
  @IsIn(['REPLAY', 'SENSOR'])
  inputKind!: 'REPLAY' | 'SENSOR';
  @ApiProperty({ enum: ['Cardiac', 'Seizure', 'Stroke'] })
  @IsIn(['Cardiac', 'Seizure', 'Stroke'])
  model!: 'Cardiac' | 'Seizure' | 'Stroke';
  @ApiProperty() @Matches(/^[a-f0-9]{64}$/) modelSha256!: string;
  @ApiProperty({ enum: ['1'] }) @Equals('1') featureVersion!: '1';
  @ApiProperty({ enum: ['1'] }) @Equals('1') decisionVersion!: '1';
  @ApiProperty() @IsISO8601({ strict: true }) windowStartAt!: string;
  @ApiProperty() @IsISO8601({ strict: true }) windowEndAt!: string;
}

export class AiEventDto extends DeviceEventDto {
  @ApiProperty({ type: AiProvenanceDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => AiProvenanceDto)
  ai!: AiProvenanceDto;
}

export class AiHeartbeatDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() associationId!: string;
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9.+_-]{1,32}$/)
  runtimeVersion!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() bootId!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(10000) queueDepth!: number;
  @ApiProperty({ enum: DETECTOR_STATUSES })
  @IsIn(DETECTOR_STATUSES)
  cardiac!: DetectorStatus;
  @ApiProperty({ enum: DETECTOR_STATUSES })
  @IsIn(DETECTOR_STATUSES)
  seizure!: DetectorStatus;
  @ApiProperty({ enum: DETECTOR_STATUSES })
  @IsIn(DETECTOR_STATUSES)
  stroke!: DetectorStatus;
}

export class AiSessionResponse {
  @ApiProperty({ format: 'uuid' }) associationId!: string;
  @ApiProperty() paired!: boolean;
  /** Always ACTIVE: every live detection can raise an alert. */
  @ApiProperty({ enum: ['ACTIVE'] }) mode!: 'ACTIVE';
}

export class AiEventReceiptResponse {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ type: String, nullable: true }) incidentId!: string | null;
  @ApiProperty() duplicate!: boolean;
  @ApiProperty({ enum: ['ACTIVE', 'REPLAY', 'DELAYED'] })
  processingMode!: string;
}
