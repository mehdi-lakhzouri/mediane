import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ClientContext } from '../../../common/application/client-context';
import { ClientInfo } from '../../../common/http/decorators/client-context.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import { ApiMobileAuth } from '../../../common/http/swagger/api-security.decorators';
import type { AuthenticatedUser } from '../../auth/domain/authenticated-user';
import {
  CurrentUser,
  Roles,
} from '../../auth/presentation/decorators/auth.decorators';
import {
  RateLimit,
  RateLimitPolicies,
} from '../../security/presentation/rate-limit.policies';
import { Role } from '../../users/domain/role';
import {
  FamiliesService,
  FamilyInvitePreview,
  FamilyInviteView,
  IncomingJoinRequestView,
  MyFamilyView,
} from '../application/families.service';
import {
  FamilyInvitePreviewResponse,
  FamilyInviteResponse,
  FamilyNameDto,
  FamilySharingDto,
  IncomingJoinRequestResponse,
  JoinFamilyDto,
  MyFamilyResponse,
  TransferOwnershipDto,
} from './dto/family.dto';

/**
 * The caller's own family (drivers, mobile app). "mine" is always resolved
 * from the session: no family id travels from the client for these routes.
 * Most answers return the updated "my family" view so the app can re-render.
 */
@ApiTags('families')
@ApiMobileAuth()
@ApiErrorResponses(
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
  HttpStatus.CONFLICT,
  HttpStatus.UNPROCESSABLE_ENTITY,
)
@Roles(Role.DRIVER)
@Controller('families')
export class FamiliesController {
  constructor(private readonly families: FamiliesService) {}

  @Get('mine')
  @ApiOperation({
    summary: 'My family (members, my sharing) or my pending join request',
  })
  @ApiEnvelopeResponse(MyFamilyResponse)
  getMine(@CurrentUser() me: AuthenticatedUser): Promise<MyFamilyView> {
    return this.families.getMine(me.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a family; I become its owner' })
  @ApiEnvelopeResponse(MyFamilyResponse, { status: HttpStatus.CREATED })
  create(
    @CurrentUser() me: AuthenticatedUser,
    @Body() dto: FamilyNameDto,
    @ClientInfo() client: ClientContext,
  ): Promise<MyFamilyView> {
    return this.families.create(me.userId, dto.name, client);
  }

  @Patch('mine')
  @ApiOperation({ summary: 'Rename my family (owner)' })
  @ApiEnvelopeResponse(MyFamilyResponse)
  rename(
    @CurrentUser() me: AuthenticatedUser,
    @Body() dto: FamilyNameDto,
    @ClientInfo() client: ClientContext,
  ): Promise<MyFamilyView> {
    return this.families.rename(me.userId, dto.name, client);
  }

  @Delete('mine')
  @ApiOperation({ summary: 'Dissolve my family (owner): every member leaves' })
  @ApiEnvelopeResponse(null)
  async dissolve(
    @CurrentUser() me: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<null> {
    await this.families.dissolve(me.userId, client);
    return null;
  }

  // --- invitations ---------------------------------------------------------

  @Get('mine/invite')
  @ApiOperation({
    summary: 'The join code and link to share (owner); renewed when expired',
  })
  @ApiEnvelopeResponse(FamilyInviteResponse)
  getInvite(@CurrentUser() me: AuthenticatedUser): Promise<FamilyInviteView> {
    return this.families.getInvite(me.userId);
  }

  @Post('mine/invite/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Replace the join code (owner); the old one stops working',
  })
  @ApiEnvelopeResponse(FamilyInviteResponse)
  rotateInvite(
    @CurrentUser() me: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<FamilyInviteView> {
    return this.families.rotateInvite(me.userId, client);
  }

  @Get('invites/:code')
  @RateLimit(RateLimitPolicies.FAMILY_JOIN)
  @ApiOperation({ summary: 'Which family a code belongs to, before asking' })
  @ApiEnvelopeResponse(FamilyInvitePreviewResponse)
  previewInvite(@Param('code') code: string): Promise<FamilyInvitePreview> {
    return this.families.previewInvite(code);
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.FAMILY_JOIN)
  @ApiOperation({
    summary: 'Ask to join a family with its code; the owner must approve',
  })
  @ApiEnvelopeResponse(MyFamilyResponse)
  requestToJoin(
    @CurrentUser() me: AuthenticatedUser,
    @Body() dto: JoinFamilyDto,
    @ClientInfo() client: ClientContext,
  ): Promise<MyFamilyView> {
    return this.families.requestToJoin(me.userId, dto.code, client);
  }

  @Delete('join-request')
  @ApiOperation({ summary: 'Withdraw my pending request' })
  @ApiEnvelopeResponse(null)
  async cancelMyRequest(
    @CurrentUser() me: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<null> {
    await this.families.cancelMyRequest(me.userId, client);
    return null;
  }

  @Get('mine/join-requests')
  @ApiOperation({ summary: 'Requests waiting for my answer (owner)' })
  @ApiEnvelopeResponse(IncomingJoinRequestResponse, { isArray: true })
  listJoinRequests(
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<IncomingJoinRequestView[]> {
    return this.families.listJoinRequests(me.userId);
  }

  @Post('mine/join-requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a request (owner)' })
  @ApiEnvelopeResponse(MyFamilyResponse)
  approve(
    @CurrentUser() me: AuthenticatedUser,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @ClientInfo() client: ClientContext,
  ): Promise<MyFamilyView> {
    return this.families.approveJoinRequest(me.userId, requestId, client);
  }

  @Post('mine/join-requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a request (owner)' })
  @ApiEnvelopeResponse(null)
  async reject(
    @CurrentUser() me: AuthenticatedUser,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @ClientInfo() client: ClientContext,
  ): Promise<null> {
    await this.families.rejectJoinRequest(me.userId, requestId, client);
    return null;
  }

  // --- membership ------------------------------------------------------------

  @Delete('mine/members/:userId')
  @ApiOperation({ summary: 'Remove a member (owner)' })
  @ApiEnvelopeResponse(MyFamilyResponse)
  removeMember(
    @CurrentUser() me: AuthenticatedUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @ClientInfo() client: ClientContext,
  ): Promise<MyFamilyView> {
    return this.families.removeMember(me.userId, userId, client);
  }

  @Post('mine/owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hand ownership to another member (owner)' })
  @ApiEnvelopeResponse(MyFamilyResponse)
  transferOwnership(
    @CurrentUser() me: AuthenticatedUser,
    @Body() dto: TransferOwnershipDto,
    @ClientInfo() client: ClientContext,
  ): Promise<MyFamilyView> {
    return this.families.transferOwnership(me.userId, dto.userId, client);
  }

  @Post('mine/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Leave my family. An owner is replaced by the longest-standing member; alone, the family is dissolved.',
  })
  @ApiEnvelopeResponse(MyFamilyResponse)
  leave(
    @CurrentUser() me: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<MyFamilyView> {
    return this.families.leave(me.userId, client);
  }

  @Put('mine/sharing')
  @ApiOperation({
    summary:
      'What I share with my family beyond name and photo (each is my consent, off by default)',
  })
  @ApiEnvelopeResponse(MyFamilyResponse)
  updateSharing(
    @CurrentUser() me: AuthenticatedUser,
    @Body() dto: FamilySharingDto,
    @ClientInfo() client: ClientContext,
  ): Promise<MyFamilyView> {
    return this.families.updateSharing(me.userId, dto, client);
  }
}
