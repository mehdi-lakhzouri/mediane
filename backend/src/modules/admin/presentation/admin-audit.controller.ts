import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResult } from '../../../common/http/response/api-response';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import { ApiSessionAuth } from '../../../common/http/swagger/api-security.decorators';
import { Roles } from '../../auth/presentation/decorators/auth.decorators';
import { Role } from '../../users/domain/role';
import {
  AdminAuditQueryService,
  type AdminAuditView,
} from '../application/admin-audit-query.service';
import {
  AdminAuditResponse,
  AdminAuditStatsResponse,
  ListAdminAuditQueryDto,
} from './dto/admin-audit.dto';

@ApiTags('admin / audit')
@ApiSessionAuth()
@ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Roles(Role.ADMIN)
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditQueryService) {}

  @Get()
  @ApiOperation({ summary: 'Search the immutable administrative audit log' })
  @ApiEnvelopeResponse(AdminAuditResponse, { isArray: true })
  async list(
    @Query() query: ListAdminAuditQueryDto,
  ): Promise<ApiResult<AdminAuditView[]>> {
    const { items, totalItems } = await this.audit.list({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      category: query.category,
      actorType: query.actorType,
      outcome: query.outcome,
      targetType: query.targetType,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      sortDir: query.sortDir,
    });
    return ApiResult.paginated(items, {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Global audit statistics' })
  @ApiEnvelopeResponse(AdminAuditStatsResponse)
  stats() {
    return this.audit.stats();
  }
}
