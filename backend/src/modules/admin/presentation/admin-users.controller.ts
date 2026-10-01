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
  AdminActor,
  AdminUserManagementService,
  AdminUserView,
} from '../application/admin-user-management.service';
import {
  AdminUserResponse,
  CreateUserDto,
  HardDeleteUserDto,
  ListUsersQueryDto,
  UpdateUserDto,
} from './dto/admin-user.dto';

const toActor = (
  principal: AuthenticatedUser,
  client: ClientContext,
): AdminActor => ({ adminId: principal.userId, client });

/** Every route: authenticated (global guard) + ADMIN role + ACTIVE account (default). */
@ApiTags('admin / users')
@ApiSessionAuth()
@ApiErrorResponses(
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
)
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly admin: AdminUserManagementService) {}

  @Post()
  @ApiCsrf()
  @ApiOperation({ summary: 'Create a user and send the invitation' })
  @ApiEnvelopeResponse(AdminUserResponse, { status: HttpStatus.CREATED })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<AdminUserView> {
    return this.admin.createUser(dto, toActor(principal, client));
  }

  @Get()
  @ApiOperation({
    summary: 'List users (soft-deleted excluded unless requested)',
  })
  @ApiEnvelopeResponse(AdminUserResponse, { isArray: true })
  async list(
    @Query() query: ListUsersQueryDto,
  ): Promise<ApiResult<AdminUserView[]>> {
    const { items, totalItems } = await this.admin.listUsers(query);
    return ApiResult.paginated(items, {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
    });
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get a user with its derived account state' })
  @ApiEnvelopeResponse(AdminUserResponse)
  get(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<AdminUserView> {
    return this.admin.getUser(userId);
  }

  @Patch(':userId')
  @ApiCsrf()
  @ApiOperation({ summary: 'Update user identity fields' })
  @ApiEnvelopeResponse(AdminUserResponse)
  update(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<AdminUserView> {
    return this.admin.updateUser(userId, dto, toActor(principal, client));
  }

  @Post(':userId/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiCsrf()
  @ApiOperation({ summary: 'Suspend a user and revoke all their sessions' })
  @ApiEnvelopeResponse(AdminUserResponse)
  suspend(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<AdminUserView> {
    return this.admin.suspendUser(userId, toActor(principal, client));
  }

  @Post(':userId/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiCsrf()
  @ApiOperation({ summary: 'Reactivate a suspended user' })
  @ApiEnvelopeResponse(AdminUserResponse)
  reactivate(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<AdminUserView> {
    return this.admin.reactivateUser(userId, toActor(principal, client));
  }

  @Delete(':userId')
  @ApiCsrf()
  @ApiOperation({ summary: 'Soft delete a user (restorable)' })
  @ApiEnvelopeResponse(null)
  async softDelete(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<null> {
    await this.admin.softDeleteUser(userId, toActor(principal, client));
    return null;
  }

  @Post(':userId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiCsrf()
  @ApiOperation({ summary: 'Restore a soft-deleted user' })
  @ApiEnvelopeResponse(AdminUserResponse)
  restore(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<AdminUserView> {
    return this.admin.restoreUser(userId, toActor(principal, client));
  }

  @Post(':userId/hard-delete')
  @HttpCode(HttpStatus.OK)
  @ApiCsrf()
  @ApiOperation({
    summary:
      'Permanently delete a soft-deleted user (irreversible, explicit confirmation)',
  })
  @ApiEnvelopeResponse(null)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNPROCESSABLE_ENTITY)
  async hardDelete(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: HardDeleteUserDto,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<null> {
    await this.admin.hardDeleteUser(
      userId,
      dto.confirmEmail,
      toActor(principal, client),
    );
    return null;
  }
}
