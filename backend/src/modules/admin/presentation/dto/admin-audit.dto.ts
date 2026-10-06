import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/http/dto/pagination-query.dto';
import { AuditCategory } from '../../../audit/domain/audit-category';
import { AuditAction } from '../../../audit/domain/audit-action';
import type {
  AuditActorType,
  AuditOutcome,
  AuditTargetType,
} from '../../../audit/domain/audit-entry';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const ACTOR_TYPES: readonly AuditActorType[] = [
  'USER',
  'SYSTEM',
  'CLI',
  'DEVICE',
];
const OUTCOMES: readonly AuditOutcome[] = ['SUCCESS', 'FAILURE'];
const TARGET_TYPES: readonly AuditTargetType[] = [
  'USER',
  'INVITATION',
  'SESSION',
  'FAMILY',
  'DEVICE',
  'INCIDENT',
];

export class ListAdminAuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Matches action, request ID, IP address or an exact UUID',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(128)
  search?: string;

  @ApiPropertyOptional({ enum: Object.values(AuditCategory) })
  @IsOptional()
  @IsIn(Object.values(AuditCategory))
  category?: AuditCategory;

  @ApiPropertyOptional({ enum: ACTOR_TYPES })
  @IsOptional()
  @IsIn(ACTOR_TYPES)
  actorType?: AuditActorType;

  @ApiPropertyOptional({ enum: OUTCOMES })
  @IsOptional()
  @IsIn(OUTCOMES)
  outcome?: AuditOutcome;

  @ApiPropertyOptional({ enum: TARGET_TYPES })
  @IsOptional()
  @IsIn(TARGET_TYPES)
  targetType?: AuditTargetType;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}

class AdminAuditActorResponse {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
}

export class AdminAuditResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: Object.values(AuditAction) }) action!: string;
  @ApiProperty({ enum: Object.values(AuditCategory) })
  category!: AuditCategory;
  @ApiProperty({ enum: OUTCOMES }) outcome!: AuditOutcome;
  @ApiProperty({ enum: ACTOR_TYPES }) actorType!: AuditActorType;
  @ApiProperty({ nullable: true, format: 'uuid', type: String })
  actorUserId!: string | null;
  @ApiProperty({ nullable: true, type: AdminAuditActorResponse })
  actor!: AdminAuditActorResponse | null;
  @ApiProperty({ nullable: true, enum: TARGET_TYPES })
  targetType!: AuditTargetType | null;
  @ApiProperty({ nullable: true, format: 'uuid', type: String })
  targetId!: string | null;
  @ApiProperty({ nullable: true, type: String }) requestId!: string | null;
  @ApiProperty({ nullable: true, type: String }) ipAddress!: string | null;
  @ApiProperty({ nullable: true, type: String }) userAgent!: string | null;
  @ApiProperty({ nullable: true, type: Object })
  metadata!: Record<string, unknown> | null;
  @ApiProperty({ type: Date }) createdAt!: Date;
}

export class AdminAuditStatsResponse {
  @ApiProperty() total!: number;
  @ApiProperty() last24Hours!: number;
  @ApiProperty() securityEvents!: number;
  @ApiProperty() failures!: number;
  @ApiProperty() uniqueActors!: number;
}
