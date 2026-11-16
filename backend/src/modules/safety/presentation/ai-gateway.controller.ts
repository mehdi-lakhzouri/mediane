import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import type { AuthenticatedDevice } from '../../devices/domain/device';
import {
  CurrentDevice,
  DeviceAuth,
} from '../../devices/presentation/device-auth.guard';
import {
  RateLimit,
  RateLimitPolicies,
} from '../../security/presentation/rate-limit.policies';
import { AiGatewayService } from '../application/ai-gateway.service';
import {
  AiEventDto,
  AiEventReceiptResponse,
  AiHeartbeatDto,
  AiSessionResponse,
} from './dto/ai-gateway.dto';

@ApiTags('device / AI')
@ApiErrorResponses(
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.CONFLICT,
)
@DeviceAuth()
@RateLimit(RateLimitPolicies.DEVICE)
@Controller('device/ai')
export class AiGatewayController {
  constructor(private readonly gateway: AiGatewayService) {}

  @Get('session')
  @ApiEnvelopeResponse(AiSessionResponse)
  session(@CurrentDevice() device: AuthenticatedDevice) {
    return this.gateway.session(device.id);
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiEnvelopeResponse(AiSessionResponse)
  heartbeat(
    @CurrentDevice() device: AuthenticatedDevice,
    @Body() dto: AiHeartbeatDto,
  ) {
    return this.gateway.heartbeat(device.id, dto);
  }

  @Post('events')
  @HttpCode(HttpStatus.OK)
  @ApiEnvelopeResponse(AiEventReceiptResponse)
  report(
    @CurrentDevice() device: AuthenticatedDevice,
    @Body() dto: AiEventDto,
  ) {
    return this.gateway.report(device.id, dto);
  }
}
