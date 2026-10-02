import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/http/dto/pagination-query.dto';
import {
  FamilyPolicy,
  FamilyRole,
  JoinRequestStatus,
} from '../../domain/family';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// 8 characters, an optional dash/spaces: "K7M4-QX9P", "k7m4qx9p"
const INVITE_CODE = /^[A-Za-z0-9]{4}[\s-]?[A-Za-z0-9]{4}$/;

export class FamilyNameDto {
  @ApiProperty({
    example: 'Ben Salah family',
    maxLength: FamilyPolicy.NAME_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FamilyPolicy.NAME_MAX_LENGTH)
  name!: string;
}

export class JoinFamilyDto {
  @ApiProperty({
    example: 'K7M4-QX9P',
    description: 'Code or the end of the invitation link',
  })
  @Transform(trim)
  @IsString()
  @Matches(INVITE_CODE, { message: 'code must look like K7M4-QX9P' })
  code!: string;
}

export class TransferOwnershipDto {
  @ApiProperty({ format: 'uuid', description: 'A member of the family' })
  @IsUUID()
  userId!: string;
}

export class AddFamilyMemberDto {
  @ApiProperty({ format: 'uuid', description: 'A driver without a family' })
  @IsUUID()
  userId!: string;
}

/** Only the flags sent are changed. */
export class FamilySharingDto {
  @ApiPropertyOptional({ description: 'Show my phone number to my family' })
  @IsOptional()
  @IsBoolean()
  phone?: boolean;

  @ApiPropertyOptional({
    description: 'Alert my family when I have an incident',
  })
  @IsOptional()
  @IsBoolean()
  incidents?: boolean;

  @ApiPropertyOptional({
    description: 'Share my recent health status with my family',
  })
  @IsOptional()
  @IsBoolean()
  health?: boolean;
}

export class ListFamiliesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Family name, or a member name/email' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

// ------------------------------------------------------------ responses

class SharingResponse {
  @ApiProperty() phone!: boolean;
  @ApiProperty() incidents!: boolean;
  @ApiProperty() health!: boolean;
}

class AvatarResponse {
  @ApiProperty() url!: string;
  @ApiProperty({ type: Date }) expiresAt!: Date;
}

export class FamilyMemberResponse {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: Object.values(FamilyRole) }) role!: FamilyRole;
  @ApiProperty({ type: Date }) joinedAt!: Date;
  @ApiProperty({ nullable: true, type: AvatarResponse })
  avatar!: AvatarResponse | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Only if this member shares it',
  })
  phoneNumber!: string | null;
  @ApiProperty({ type: SharingResponse }) sharing!: SharingResponse;
}

export class FamilyResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: Object.values(FamilyRole) }) myRole!: FamilyRole;
  @ApiProperty({ type: SharingResponse }) mySharing!: SharingResponse;
  @ApiProperty({ example: FamilyPolicy.MAX_MEMBERS }) maxMembers!: number;
  @ApiProperty({ type: [FamilyMemberResponse] })
  members!: FamilyMemberResponse[];
  @ApiProperty({ nullable: true, type: Number, description: 'Owner only' })
  pendingRequestCount!: number | null;
}

export class JoinRequestResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() familyName!: string;
  @ApiProperty({ enum: Object.values(JoinRequestStatus) })
  status!: JoinRequestStatus;
  @ApiProperty({ type: Date }) createdAt!: Date;
  @ApiProperty({ type: Date }) expiresAt!: Date;
}

export class MyFamilyResponse {
  @ApiProperty({ nullable: true, type: FamilyResponse })
  family!: FamilyResponse | null;
  @ApiProperty({ nullable: true, type: JoinRequestResponse })
  pendingRequest!: JoinRequestResponse | null;
}

export class FamilyInviteResponse {
  @ApiProperty({ example: 'K7M4-QX9P' }) code!: string;
  @ApiProperty({ example: 'https://cabinguard.app/join-family#K7M4-QX9P' })
  link!: string;
  @ApiProperty({ type: Date }) expiresAt!: Date;
}

export class FamilyInvitePreviewResponse {
  @ApiProperty() familyName!: string;
  @ApiProperty({ nullable: true, type: String }) ownerFirstName!: string | null;
  @ApiProperty() memberCount!: number;
  @ApiProperty() maxMembers!: number;
  @ApiProperty() full!: boolean;
}

export class IncomingJoinRequestResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ nullable: true, type: AvatarResponse })
  avatar!: AvatarResponse | null;
  @ApiProperty({ type: Date }) createdAt!: Date;
  @ApiProperty({ type: Date }) expiresAt!: Date;
}

class AdminFamilyMemberResponse {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: Object.values(FamilyRole) }) role!: FamilyRole;
  @ApiProperty({ type: Date }) joinedAt!: Date;
}

class FamilyOwnerResponse {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
}

export class AdminFamilyResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: Date }) createdAt!: Date;
  @ApiProperty() memberCount!: number;
  @ApiProperty({ nullable: true, type: FamilyOwnerResponse })
  owner!: FamilyOwnerResponse | null;
  @ApiPropertyOptional({
    type: [AdminFamilyMemberResponse],
    description: 'Detail view only',
  })
  members?: AdminFamilyMemberResponse[];
  @ApiPropertyOptional({ description: 'Detail view only' })
  pendingRequestCount?: number;
}
