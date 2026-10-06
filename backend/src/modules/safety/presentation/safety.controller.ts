import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ClientContext } from '../../../common/application/client-context';
import { PaginationQueryDto } from '../../../common/http/dto/pagination-query.dto';
import { ClientInfo } from '../../../common/http/decorators/client-context.decorator';
import { ApiResult } from '../../../common/http/response/api-response';
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
import { IncidentResponseService } from '../application/incident-response.service';
import {
  type FamilyIncidentView,
  SafetyQueryService,
} from '../application/safety-query.service';
import { IncidentActorChannel } from '../domain/safety';
import { ListEventsQueryDto, SosDto, toGeoPoint } from './dto/safety-input.dto';
import {
  FamilyIncidentResponse,
  IncidentDetailResponse,
  IncidentResponse,
  MedicalEventResponse,
  MedicalEventSummaryResponse,
} from './dto/safety-response.dto';
import {
  presentEvent,
  presentEventSummary,
  presentIncident,
  presentIncidentDetail,
} from './safety.presenter';

/**
 * The driver's own safety data (mobile app). Everything is scoped to the
 * session user; ids in paths only ever select among the caller's records.
 */
@ApiTags('safety')
@ApiMobileAuth()
@ApiErrorResponses(
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
)
@Roles(Role.DRIVER)
@Controller()
export class SafetyController {
  constructor(
    private readonly queries: SafetyQueryService,
    private readonly response: IncidentResponseService,
  ) {}

  @Get('safety/events')
  @ApiOperation({ summary: 'My detections and SOS presses, newest first' })
  @ApiEnvelopeResponse(MedicalEventSummaryResponse, { isArray: true })
  async listEvents(
    @Query() query: ListEventsQueryDto,
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<ApiResult<MedicalEventSummaryResponse[]>> {
    const { items, totalItems } = await this.queries.listEvents(
      me.userId,
      query,
    );
    return ApiResult.paginated(items.map(presentEventSummary), {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
    });
  }

  @Get('safety/events/:eventId')
  @ApiOperation({ summary: 'One of my events, with readings and location' })
  @ApiEnvelopeResponse(MedicalEventResponse)
  async getEvent(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<MedicalEventResponse> {
    return presentEvent(await this.queries.getEvent(me.userId, eventId));
  }

  @Get('safety/incidents')
  @ApiOperation({ summary: 'My incidents, newest first' })
  @ApiEnvelopeResponse(IncidentResponse, { isArray: true })
  async listIncidents(
    @Query() query: PaginationQueryDto,
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<ApiResult<IncidentResponse[]>> {
    const { items, totalItems } = await this.queries.listIncidents(
      me.userId,
      query,
    );
    return ApiResult.paginated(items.map(presentIncident), {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
    });
  }

  @Get('safety/incidents/active')
  @ApiOperation({
    summary:
      'My open incident with countdown, events and who was contacted; null when none',
  })
  @ApiEnvelopeResponse(IncidentDetailResponse)
  async getActive(
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<IncidentDetailResponse | null> {
    const detail = await this.queries.activeDetail(me.userId);
    return detail ? presentIncidentDetail(detail) : null;
  }

  @Get('safety/incidents/:incidentId')
  @ApiOperation({ summary: 'One of my incidents with its full story' })
  @ApiEnvelopeResponse(IncidentDetailResponse)
  async getIncident(
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<IncidentDetailResponse> {
    return presentIncidentDetail(
      await this.queries.incidentDetail(me.userId, incidentId),
    );
  }

  @Post('safety/incidents/:incidentId/acknowledge')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.SAFETY_ACTION)
  @ApiOperation({
    summary:
      '"I\'m OK": cancels before escalation, resolves (with all-clear) after. Idempotent.',
  })
  @ApiEnvelopeResponse(IncidentResponse)
  async acknowledge(
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @CurrentUser() me: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<IncidentResponse> {
    return presentIncident(
      await this.response.acknowledge(
        me.userId,
        { incidentId },
        IncidentActorChannel.APP,
        client,
      ),
    );
  }

  @Post('safety/sos')
  @RateLimit(RateLimitPolicies.SAFETY_ACTION)
  @ApiOperation({
    summary:
      'Call for help now (sent after the app cancel window). Idempotent per clientEventId.',
  })
  @ApiEnvelopeResponse(IncidentResponse, { status: HttpStatus.CREATED })
  async sos(
    @Body() dto: SosDto,
    @CurrentUser() me: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<IncidentResponse> {
    return presentIncident(
      await this.response.triggerSos(
        me.userId,
        {
          clientEventId: dto.clientEventId,
          location: toGeoPoint(dto.location),
        },
        client,
      ),
    );
  }

  @Get('families/mine/incidents')
  @ApiOperation({
    summary:
      'Open and recent incidents of family members who share them with me (no medical details)',
  })
  @ApiEnvelopeResponse(FamilyIncidentResponse, { isArray: true })
  familyIncidents(
    @CurrentUser() me: AuthenticatedUser,
  ): Promise<FamilyIncidentView[]> {
    return this.queries.familyIncidents(me.userId);
  }
}
