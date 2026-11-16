import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/http/dto/pagination-query.dto';
import {
  ADMIN_INCIDENT_SORTS,
  type AdminIncidentFilter,
} from '../../domain/admin-incident.repository';
import { IncidentStatus, IncidentTimelineKind } from '../../domain/incident';
import {
  NotificationChannel,
  NotificationKind,
  NotificationStatus,
} from '../../domain/notification';

export class ListAdminIncidentsQueryDto
  extends PaginationQueryDto
  implements AdminIncidentFilter
{
  @ApiPropertyOptional({
    description: 'Driver name, email or exact incident UUID',
    maxLength: 128,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(128)
  search?: string;
  @ApiPropertyOptional({ enum: Object.values(IncidentStatus) })
  @IsOptional()
  @IsIn(Object.values(IncidentStatus))
  status?: IncidentStatus;
  @ApiPropertyOptional({ enum: ['24h', '7d', '30d'] })
  @IsOptional()
  @IsIn(['24h', '7d', '30d'])
  period?: '24h' | '7d' | '30d';
  @ApiPropertyOptional({ enum: ADMIN_INCIDENT_SORTS, default: 'openedAt' })
  @IsOptional()
  @IsIn(ADMIN_INCIDENT_SORTS)
  sortBy?: (typeof ADMIN_INCIDENT_SORTS)[number];
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}

class AdminIncidentDriverResponse {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
}
export class AdminIncidentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: Object.values(IncidentStatus) }) status!: IncidentStatus;
  @ApiProperty({ type: AdminIncidentDriverResponse })
  driver!: AdminIncidentDriverResponse;
  @ApiProperty({ type: Date }) openedAt!: Date;
  @ApiProperty({ type: Date, nullable: true }) respondBy!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) acknowledgedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) acknowledgedVia!:
    string | null;
  @ApiProperty({ type: Date, nullable: true }) escalatedAt!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) resolvedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) resolvedVia!: string | null;
  @ApiProperty() eventCount!: number;
  @ApiProperty() notificationCount!: number;
}
export class AdminIncidentStatsResponse {
  @ApiProperty() total!: number;
  @ApiProperty() awaitingResponse!: number;
  @ApiProperty() escalated!: number;
  @ApiProperty() resolved!: number;
  @ApiProperty() falseAlarm!: number;
}
class AdminIncidentTimelineResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: Object.values(IncidentTimelineKind) })
  kind!: IncidentTimelineKind;
  @ApiProperty({ type: Date }) at!: Date;
}
class AdminIncidentNotificationResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: Object.values(NotificationKind) })
  kind!: NotificationKind;
  @ApiProperty({ enum: Object.values(NotificationChannel) })
  channel!: NotificationChannel;
  @ApiProperty({ enum: Object.values(NotificationStatus) })
  status!: NotificationStatus;
  @ApiProperty({ type: Date }) attemptedAt!: Date;
}
export class AdminIncidentDetailResponse extends AdminIncidentResponse {
  @ApiProperty({ type: [AdminIncidentTimelineResponse] })
  timeline!: AdminIncidentTimelineResponse[];
  @ApiProperty({ type: [AdminIncidentNotificationResponse] })
  notifications!: AdminIncidentNotificationResponse[];
}
