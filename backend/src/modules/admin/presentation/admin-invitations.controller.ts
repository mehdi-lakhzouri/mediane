import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
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
import {
  InvitationStatusView,
  InvitationsService,
} from '../../invitations/application/invitations.service';
import {
  AdminUserManagementService,
  type AdminUserView,
} from '../application/admin-user-management.service';
import { InvitationStatusResponse } from '../../invitations/presentation/dto/invitation.dto';
import { AdminUserResponse } from './dto/admin-user.dto';
import {
  RateLimit,
  RateLimitPolicies,
} from '../../security/presentation/rate-limit.policies';
import { Role } from '../../users/domain/role';

@ApiTags('admin / invitations')
@ApiSessionAuth()
@ApiErrorResponses(
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
)
@Roles(Role.ADMIN)
@Controller('admin/users/:userId/invitation')
export class AdminInvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly admin: AdminUserManagementService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Latest invitation of a user and its effective status',
  })
  @ApiEnvelopeResponse(InvitationStatusResponse)
  status(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<InvitationStatusView> {
    return this.invitations.getStatusForUser(userId);
  }

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.INVITATION_RESEND)
  @ApiCsrf()
  @ApiOperation({
    summary:
      'Supersede pending invitations and send a new one (new token + temporary password)',
  })
  @ApiEnvelopeResponse(AdminUserResponse)
  @ApiErrorResponses(
    HttpStatus.UNPROCESSABLE_ENTITY,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  resend(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<AdminUserView> {
    return this.admin.resendInvitation(userId, {
      adminId: principal.userId,
      client,
    });
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @ApiCsrf()
  @ApiOperation({ summary: 'Revoke the pending invitation' })
  @ApiEnvelopeResponse(InvitationStatusResponse)
  @ApiErrorResponses(HttpStatus.UNPROCESSABLE_ENTITY)
  revoke(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<InvitationStatusView> {
    return this.invitations.revoke(userId, principal.userId, client);
  }
}
