import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import type { AuthenticatedDevice } from '../../devices/domain/device';
import { DeviceNotPairedError } from '../../devices/domain/device.errors';
import {
  CurrentDevice,
  DeviceAuth,
} from '../../devices/presentation/device-auth.guard';
import {
  RateLimit,
  RateLimitPolicies,
} from '../../security/presentation/rate-limit.policies';
import { EventIngestionService } from '../application/event-ingestion.service';
import { IncidentResponseService } from '../application/incident-response.service';
import { IncidentActorChannel, MedicalEventSource } from '../domain/safety';
import { DeviceEventDto, toGeoPoint, toVitals } from './dto/safety-input.dto';
import {
  DeviceAcknowledgeResponse,
  DeviceEventReceiptResponse,
} from './dto/safety-response.dto';

function pairedDriver(device: AuthenticatedDevice): string {
  if (!device.pairedUserId) throw new DeviceNotPairedError();
  return device.pairedUserId;
}

/** Signed requests from in-cabin units, on behalf of their paired driver. */
@ApiTags('device')
@ApiErrorResponses(
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.CONFLICT,
  HttpStatus.UNPROCESSABLE_ENTITY,
)
@DeviceAuth()
@RateLimit(RateLimitPolicies.DEVICE)
@Controller('device')
export class DeviceSafetyController {
  constructor(
    private readonly ingestion: EventIngestionService,
    private readonly response: IncidentResponseService,
  ) {}

  @Post('events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Report a detection or a cabin SOS press. Severity is decided by the server.',
  })
  @ApiEnvelopeResponse(DeviceEventReceiptResponse)
  async report(
    @Body() dto: DeviceEventDto,
    @CurrentDevice() device: AuthenticatedDevice,
  ): Promise<DeviceEventReceiptResponse> {
    const { event, incident, duplicate } = await this.ingestion.report({
      userId: pairedDriver(device),
      source: MedicalEventSource.DEVICE,
      deviceId: device.id,
      type: dto.type,
      clientEventId: dto.clientEventId,
      detectedAt: new Date(dto.detectedAt),
      confidence: dto.confidence ?? null,
      vitals: toVitals(dto.vitals),
      location: toGeoPoint(dto.location),
    });
    return {
      eventId: event.id,
      incidentId: incident?.id ?? null,
      incidentStatus: incident?.status ?? null,
      respondBy: incident?.respondBy ?? null,
      duplicate,
    };
  }

  @Post('acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cabin "I\'m OK" button: answers the driver\'s open incident',
  })
  @ApiEnvelopeResponse(DeviceAcknowledgeResponse)
  async acknowledge(
    @CurrentDevice() device: AuthenticatedDevice,
  ): Promise<DeviceAcknowledgeResponse> {
    const incident = await this.response.acknowledge(
      pairedDriver(device),
      { active: true },
      IncidentActorChannel.DEVICE,
    );
    return { incidentId: incident.id, status: incident.status };
  }
}
