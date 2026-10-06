import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/http/dto/pagination-query.dto';
import { InvitationStatus } from '../../../invitations/domain/invitation';
import {
  INVITATION_SORT_FIELDS,
  type InvitationSortField,
} from '../../../invitations/domain/invitation.repository';
import { Role } from '../../../users/domain/role';
import { UserStatus } from '../../../users/domain/user-status';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const EFFECTIVE_STATUSES = [
  ...Object.values(InvitationStatus),
  'EXPIRED',
] as const;
const ROLES = Object.values(Role);

export class ListAdminInvitationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Matches the invitee email, first name or last name',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: EFFECTIVE_STATUSES })
  @IsOptional()
  @IsIn(EFFECTIVE_STATUSES)
  status?: (typeof EFFECTIVE_STATUSES)[number];

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @ApiPropertyOptional({ enum: INVITATION_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(INVITATION_SORT_FIELDS)
  sortBy?: InvitationSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}

class InvitationInviterResponse {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
}

export class AdminInvitationResponse {
  @ApiProperty({ format: 'uuid' }) invitationId!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: ROLES }) role!: Role;
  @ApiProperty({ enum: Object.values(UserStatus) }) userStatus!: UserStatus;
  @ApiProperty({ nullable: true, type: Date }) userDeletedAt!: Date | null;
  @ApiProperty({ enum: EFFECTIVE_STATUSES })
  status!: (typeof EFFECTIVE_STATUSES)[number];
  @ApiProperty({ nullable: true, type: InvitationInviterResponse })
  invitedBy!: InvitationInviterResponse | null;
  @ApiProperty({ type: Date }) createdAt!: Date;
  @ApiProperty({ type: Date }) expiresAt!: Date;
  @ApiProperty({ nullable: true, type: Date }) acceptedAt!: Date | null;
  @ApiProperty({ nullable: true, type: Date }) revokedAt!: Date | null;
}

export class AdminInvitationStatsResponse {
  @ApiProperty() total!: number;
  @ApiProperty() pending!: number;
  @ApiProperty() accepted!: number;
  @ApiProperty() expired!: number;
  @ApiProperty() revoked!: number;
  @ApiProperty() superseded!: number;
  @ApiProperty({ example: 72.5 }) acceptanceRate!: number;
}
