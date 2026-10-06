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
  type DeviceAdminActor,
  DevicesService,
  type DeviceWithSecret,
} from '../application/devices.service';
import type { DeviceRecord } from '../domain/device';
import {
  DeviceResponse,
  DeviceWithSecretResponse,
  ListDevicesQueryDto,
  PairDeviceDto,
  RegisterDeviceDto,
} from './dto/device.dto';

const toActor = (
  principal: AuthenticatedUser,
  client: ClientContext,
): DeviceAdminActor => ({ adminId: principal.userId, client });

/** Units and their pairing only; administrators never see medical events. */
@ApiTags('admin / devices')
@ApiSessionAuth()
@ApiErrorResponses(
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
)
@Roles(Role.ADMIN)
@Controller('admin/devices')
export class AdminDevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @ApiCsrf()
  @ApiOperation({ summary: 'Register a unit and reveal its signing secret' })
  @ApiEnvelopeResponse(DeviceWithSecretResponse, {
    status: HttpStatus.CREATED,
  })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
  register(
    @Body() dto: RegisterDeviceDto,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<DeviceWithSecret> {
    return this.devices.register(dto, toActor(principal, client));
  }

  @Get()
  @ApiOperation({ summary: 'List units with pairing and health' })
  @ApiEnvelopeResponse(DeviceResponse, { isArray: true })
  async list(
    @Query() query: ListDevicesQueryDto,
  ): Promise<ApiResult<DeviceRecord[]>> {
    const { items, totalItems } = await this.devices.list(query);
    return ApiResult.paginated(items, {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
    });
  }

  @Get(':deviceId')
  @ApiOperation({ summary: 'Get a unit' })
  @ApiEnvelopeResponse(DeviceResponse)
  get(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<DeviceRecord> {
    return this.devices.get(deviceId);
  }

  @Post(':deviceId/pair')
  @HttpCode(HttpStatus.OK)
  @ApiCsrf()
  @ApiOperation({ summary: 'Pair a unit with a driver (one unit per driver)' })
  @ApiEnvelopeResponse(DeviceResponse)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.CONFLICT,
    HttpStatus.UNPROCESSABLE_ENTITY,
  )
  pair(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @Body() dto: PairDeviceDto,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<DeviceRecord> {
    return this.devices.pair(deviceId, dto.userId, toActor(principal, client));
  }

  @Post(':deviceId/unpair')
  @HttpCode(HttpStatus.OK)
  @ApiCsrf()
  @ApiOperation({ summary: 'Unpair a unit from its driver' })
  @ApiEnvelopeResponse(DeviceResponse)
  unpair(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<DeviceRecord> {
    return this.devices.unpair(deviceId, toActor(principal, client));
  }

  @Post(':deviceId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiCsrf()
  @ApiOperation({ summary: 'Revoke a unit permanently (lost or replaced)' })
  @ApiEnvelopeResponse(DeviceResponse)
  revoke(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<DeviceRecord> {
    return this.devices.revoke(deviceId, toActor(principal, client));
  }

  @Post(':deviceId/rotate-secret')
  @HttpCode(HttpStatus.OK)
  @ApiCsrf()
  @ApiOperation({
    summary: 'Issue a new signing secret; the previous one stops working',
  })
  @ApiEnvelopeResponse(DeviceWithSecretResponse)
  @ApiErrorResponses(HttpStatus.UNPROCESSABLE_ENTITY)
  rotateSecret(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<DeviceWithSecret> {
    return this.devices.rotateSecret(deviceId, toActor(principal, client));
  }
}
