import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/http/dto/pagination-query.dto';
import { AccountState } from '../../../users/domain/account-state';
import { Role } from '../../../users/domain/role';
import { UserStatus } from '../../../users/domain/user-status';
import {
  USER_SORT_FIELDS,
  type SortDirection,
  type UserSortField,
} from '../../../users/domain/user.repository';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const ROLES = Object.values(Role);
const STATUSES = Object.values(UserStatus);

export class CreateUserDto {
  @ApiProperty({ example: 'driver@example.com', maxLength: 254 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES)
  role!: Role;
}

/** Email and role changes are separate privileged flows (not part of a generic update). */
export class UpdateUserDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Matches email, first name or last name',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: USER_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy?: UserSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: SortDirection;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeDeleted = false;

  @ApiPropertyOptional({
    default: false,
    description:
      'Return only soft-deleted accounts. Takes precedence over includeDeleted.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  onlyDeleted = false;
}

export class HardDeleteUserDto {
  @ApiProperty({
    description:
      "Must equal the user's email: explicit confirmation of an irreversible action",
  })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  confirmEmail!: string;
}

export class AdminUserResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: ROLES }) role!: Role;
  @ApiProperty({ enum: STATUSES }) status!: UserStatus;
  @ApiProperty({ enum: Object.values(AccountState) })
  accountState!: AccountState;
  @ApiProperty({ description: 'A TOTP authenticator is configured' })
  mfaEnabled!: boolean;
  @ApiProperty({ nullable: true, type: Date }) lastLoginAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ nullable: true, type: Date }) deletedAt!: Date | null;
}
