import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResult } from '../../../common/http/response/api-response';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import {
  ApiMobileAuth,
  ApiSessionAuth,
} from '../../../common/http/swagger/api-security.decorators';
import type { AuthenticatedUser } from '../../auth/domain/authenticated-user';
import { CurrentUser } from '../../auth/presentation/decorators/auth.decorators';
import { NotificationsService } from '../application/notifications.service';
import type { NotificationRecord } from '../domain/notification';
import {
  ListNotificationsQueryDto,
  MarkAllReadResponse,
  NotificationPreferencesDto,
  NotificationPreferencesResponse,
  NotificationResponse,
  UnreadCountResponse,
} from './dto/notification.dto';

const toResponse = ({
  userId: _userId,
  ...notification
}: NotificationRecord): NotificationResponse => notification;

/** The caller's own notification center and mute settings. */
@ApiTags('notifications')
@ApiMobileAuth()
@ApiSessionAuth()
@ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'My notifications, newest first' })
  @ApiEnvelopeResponse(NotificationResponse, { isArray: true })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST)
  async list(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<ApiResult<NotificationResponse[]>> {
    const { items, totalItems } = await this.notifications.list(
      me.userId,
      query,
    );
    return ApiResult.paginated(items.map(toResponse), {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
    });
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'How many notifications I have not read' })
  @ApiEnvelopeResponse(UnreadCountResponse)
  async unreadCount(
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<UnreadCountResponse> {
    return { unread: await this.notifications.unreadCount(me.userId) };
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiEnvelopeResponse(MarkAllReadResponse)
  async markAllRead(
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<MarkAllReadResponse> {
    return { updated: await this.notifications.markAllRead(me.userId) };
  }

  @Post('notifications/:notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark one notification as read (idempotent)' })
  @ApiEnvelopeResponse(null)
  @ApiErrorResponses(HttpStatus.NOT_FOUND)
  async markRead(
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<null> {
    await this.notifications.markRead(me.userId, notificationId);
    return null;
  }

  @Get('notification-preferences')
  @ApiOperation({ summary: 'My mute settings' })
  @ApiEnvelopeResponse(NotificationPreferencesResponse)
  async preferences(
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<NotificationPreferencesResponse> {
    return {
      ...(await this.notifications.preferences(me.userId)),
      security: true,
    };
  }

  @Put('notification-preferences')
  @ApiOperation({
    summary:
      'Replace my mute settings (security and family emergencies cannot be muted)',
  })
  @ApiEnvelopeResponse(NotificationPreferencesResponse)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST)
  async updatePreferences(
    @Body() dto: NotificationPreferencesDto,
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<NotificationPreferencesResponse> {
    const saved = await this.notifications.updatePreferences(me.userId, {
      safety: dto.safety,
      family: dto.family,
      account: dto.account,
      showNamesOnLockScreen: dto.showNamesOnLockScreen,
    });
    return { ...saved, security: true };
  }
}
