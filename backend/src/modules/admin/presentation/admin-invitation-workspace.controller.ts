import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResult } from '../../../common/http/response/api-response';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import { ApiSessionAuth } from '../../../common/http/swagger/api-security.decorators';
import { Roles } from '../../auth/presentation/decorators/auth.decorators';
import {
  AdminInvitationStatsView,
  AdminInvitationView,
  InvitationsService,
} from '../../invitations/application/invitations.service';
import { Role } from '../../users/domain/role';
import {
  AdminInvitationResponse,
  AdminInvitationStatsResponse,
  ListAdminInvitationsQueryDto,
} from './dto/admin-invitation.dto';

@ApiTags('admin / invitations')
@ApiSessionAuth()
@ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Roles(Role.ADMIN)
@Controller('admin/invitations')
export class AdminInvitationWorkspaceController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List invitation attempts and their effective status',
  })
  @ApiEnvelopeResponse(AdminInvitationResponse, { isArray: true })
  async list(
    @Query() query: ListAdminInvitationsQueryDto,
  ): Promise<ApiResult<AdminInvitationView[]>> {
    const { items, totalItems } = await this.invitations.adminList(query);
    return ApiResult.paginated(items, {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Global invitation lifecycle statistics' })
  @ApiEnvelopeResponse(AdminInvitationStatsResponse)
  stats(): Promise<AdminInvitationStatsView> {
    return this.invitations.adminStats();
  }
}
