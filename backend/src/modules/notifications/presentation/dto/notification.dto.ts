import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/http/dto/pagination-query.dto';
import { NotificationCategory } from '../../domain/notification';

const CATEGORIES = Object.values(NotificationCategory);

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Query strings carry text: only the exact words "true"/"false" count. */
const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: NotificationCategory;
}

export class NotificationResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: CATEGORIES }) category!: NotificationCategory;
  @ApiProperty({ example: 'FAMILY_MEMBER_NEEDS_HELP' }) type!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'In-app route to open, e.g. /incidents/<id>',
  })
  link!: string | null;
  @ApiProperty({ description: 'Family emergency: cannot be muted' })
  critical!: boolean;
  @ApiProperty({ type: Date, nullable: true }) readAt!: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class UnreadCountResponse {
  @ApiProperty() unread!: number;
}

export class MarkAllReadResponse {
  @ApiProperty() updated!: number;
}

export class NotificationPreferencesDto {
  @ApiProperty({
    description:
      'Safety alerts. Family emergencies always arrive, whatever this says.',
  })
  @IsBoolean()
  safety!: boolean;

  @ApiProperty() @IsBoolean() family!: boolean;

  @ApiProperty() @IsBoolean() account!: boolean;

  @ApiProperty({
    description:
      'Lock-screen previews may name people (never medical details). Applies to push.',
  })
  @IsBoolean()
  showNamesOnLockScreen!: boolean;
}

export class NotificationPreferencesResponse extends NotificationPreferencesDto {
  @ApiProperty({
    description: 'Security notifications cannot be muted.',
    example: true,
  })
  security!: true;
}

export class AnnouncementDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ maxLength: 500 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;
}

export class AnnouncementResponse {
  @ApiProperty({ description: 'Drivers who will see it' })
  recipients!: number;
}
