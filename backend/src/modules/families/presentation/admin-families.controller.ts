import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ClientContext } from '../../../common/application/client-context';
import { ClientInfo } from '../../../common/http/decorators/client-context.decorator';
import { ApiResult } from '../../../common/http/response/api-response';
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
import {
  AdminFamilyStatsView,
  AdminFamilyView,
  FamiliesService,
} from '../application/families.service';
import {
  AddFamilyMemberDto,
  AdminFamilyResponse,
  AdminFamilyStatsResponse,
  ListFamiliesQueryDto,
  TransferOwnershipDto,
} from './dto/family.dto';

/**
 * Console management of families. Administrators see who is in a family,
 * never what members share with each other. Every change is audited.
 */
@ApiTags('admin / families')
@ApiSessionAuth()
@ApiErrorResponses(
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
)
@Roles(Role.ADMIN)
@Controller('admin/families')
export class AdminFamiliesController {
  constructor(private readonly families: FamiliesService) {}

  @Get()
  @ApiOperation({ summary: 'List families (search by name or member)' })
  @ApiEnvelopeResponse(AdminFamilyResponse, { isArray: true })
  async list(
    @Query() query: ListFamiliesQueryDto,
  ): Promise<ApiResult<AdminFamilyView[]>> {
    const { items, totalItems } = await this.families.adminList(query);
    return ApiResult.paginated(items, {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Global family workspace statistics' })
  @ApiEnvelopeResponse(AdminFamilyStatsResponse)
  stats(): Promise<AdminFamilyStatsView> {
    return this.families.adminStats();
  }

  @Get(':familyId')
  @ApiOperation({ summary: 'A family and its members' })
  @ApiEnvelopeResponse(AdminFamilyResponse)
  get(
    @Param('familyId', new ParseUUIDPipe()) familyId: string,
  ): Promise<AdminFamilyView> {
    return this.families.adminGet(familyId);
  }

  @Post(':familyId/members')
  @ApiCsrf()
  @ApiOperation({ summary: 'Add a driver who has no family' })
  @ApiEnvelopeResponse(AdminFamilyResponse, { status: HttpStatus.CREATED })
  @ApiErrorResponses(HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY)
  addMember(
    @Param('familyId', new ParseUUIDPipe()) familyId: string,
    @Body() dto: AddFamilyMemberDto,
    @CurrentUser() me: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<AdminFamilyView> {
    return this.families.adminAddMember(familyId, dto.userId, {
      userId: me.userId,
      client,
    });
  }

  @Delete(':familyId/members/:userId')
  @ApiCsrf()
  @ApiOperation({
    summary:
      'Remove a member (an owner is replaced by the longest-standing member). Returns null if the family was dissolved.',
  })
  @ApiEnvelopeResponse(AdminFamilyResponse)
  removeMember(
    @Param('familyId', new ParseUUIDPipe()) familyId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() me: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<AdminFamilyView | null> {
    return this.families.adminRemoveMember(familyId, userId, {
      userId: me.userId,
      client,
    });
  }

  @Post(':familyId/owner')
  @ApiCsrf()
  @ApiOperation({ summary: 'Make another member the owner' })
  @ApiEnvelopeResponse(AdminFamilyResponse)
  setOwner(
    @Param('familyId', new ParseUUIDPipe()) familyId: string,
    @Body() dto: TransferOwnershipDto,
    @CurrentUser() me: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<AdminFamilyView> {
    return this.families.adminSetOwner(familyId, dto.userId, {
      userId: me.userId,
      client,
    });
  }

  @Delete(':familyId')
  @ApiCsrf()
  @ApiOperation({ summary: 'Dissolve a family (abuse, request)' })
  @ApiEnvelopeResponse(null)
  async dissolve(
    @Param('familyId', new ParseUUIDPipe()) familyId: string,
    @CurrentUser() me: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<null> {
    await this.families.adminDissolve(familyId, { userId: me.userId, client });
    return null;
  }
}
