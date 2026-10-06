import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import {
  RateLimit,
  RateLimitPolicies,
} from '../../security/presentation/rate-limit.policies';
import { DevicesService } from '../application/devices.service';
import type { AuthenticatedDevice } from '../domain/device';
import { CurrentDevice, DeviceAuth } from './device-auth.guard';
import { DeviceHeartbeatDto } from './dto/device.dto';

/** Called by in-cabin units, authenticated by request signature. */
@ApiTags('device')
@ApiErrorResponses(HttpStatus.UNAUTHORIZED)
@DeviceAuth()
@RateLimit(RateLimitPolicies.DEVICE)
@Controller('device')
export class DeviceController {
  constructor(private readonly devices: DevicesService) {}

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report that the unit is online' })
  @ApiEnvelopeResponse(null)
  async heartbeat(
    @Body() dto: DeviceHeartbeatDto,
    @CurrentDevice() device: AuthenticatedDevice,
  ): Promise<null> {
    await this.devices.heartbeat(device.id, dto.firmwareVersion);
    return null;
  }
}
