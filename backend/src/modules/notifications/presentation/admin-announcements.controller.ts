import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ClientContext } from '../../../common/application/client-context';
import { ClientInfo } from '../../../common/http/decorators/client-context.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import {
  ApiCsrf,
  ApiSessionAuth,
} from '../../../common/http/swagger/api-security.decorators';
import type { AuthenticatedUser } from '../../auth/domain/authenticated-user';
import {
  CurrentUser,
  Roles,
} from '../../auth/presentation/decorators/auth.decorators';
import { Role } from '../../users/domain/role';
import { NotificationsService } from '../application/notifications.service';
import { AnnouncementDto, AnnouncementResponse } from './dto/notification.dto';

@ApiTags('admin / announcements')
@ApiSessionAuth()
@ApiErrorResponses(
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
)
@Roles(Role.ADMIN)
@Controller('admin/announcements')
export class AdminAnnouncementsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @ApiCsrf()
  @ApiOperation({
    summary:
      'Send a service announcement to every active driver (mutable by them)',
  })
  @ApiEnvelopeResponse(AnnouncementResponse, { status: HttpStatus.CREATED })
  async announce(
    @Body() dto: AnnouncementDto,
    @CurrentUser() admin: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<AnnouncementResponse> {
    return {
      recipients: await this.notifications.announce(dto, {
        adminId: admin.userId,
        client,
      }),
    };
  }
}
