import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResult } from '../../../common/http/response/api-response';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import { ApiSessionAuth } from '../../../common/http/swagger/api-security.decorators';
import { Roles } from '../../auth/presentation/decorators/auth.decorators';
import { Role } from '../../users/domain/role';
import { AdminIncidentQueryService } from '../application/admin-incident-query.service';
import {
  AdminIncidentDetailResponse,
  AdminIncidentResponse,
  AdminIncidentStatsResponse,
  ListAdminIncidentsQueryDto,
} from './dto/admin-incident.dto';

/** Read-only response operations. Medical evidence remains in the owner's mobile API. */
@ApiTags('admin / incidents')
@ApiSessionAuth()
@ApiErrorResponses(
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.BAD_REQUEST,
)
@Roles(Role.ADMIN)
@Controller('admin/incidents')
export class AdminIncidentsController {
  constructor(private readonly incidents: AdminIncidentQueryService) {}
  @Get()
  @ApiOperation({
    summary: 'Search operational incidents without medical evidence',
  })
  @ApiEnvelopeResponse(AdminIncidentResponse, { isArray: true })
  async list(@Query() query: ListAdminIncidentsQueryDto) {
    const { items, totalItems } = await this.incidents.list(query);
    return ApiResult.paginated(items, {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
    });
  }
  @Get('stats')
  @ApiEnvelopeResponse(AdminIncidentStatsResponse)
  stats() {
    return this.incidents.stats();
  }
  @Get(':incidentId')
  @ApiEnvelopeResponse(AdminIncidentDetailResponse)
  @ApiErrorResponses(HttpStatus.NOT_FOUND)
  detail(@Param('incidentId', new ParseUUIDPipe()) id: string) {
    return this.incidents.detail(id);
  }
}
