import { Injectable } from '@nestjs/common';
import { AppError, ErrorKind } from '../../../common/errors';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { DeviceRepository } from '../../devices/domain/device.repository';
import type { DeviceRecord } from '../../devices/domain/device';
import {
  DeviceAuthenticationError,
  DeviceNotPairedError,
} from '../../devices/domain/device.errors';
import { DevicesService } from '../../devices/application/devices.service';
import {
  AI_EVENT_TYPES,
  AI_MAX_LIVE_AGE_MS,
  type AiDetection,
} from '../domain/ai-detection';
import { AI_MODEL_HASHES } from '../domain/ai-model-manifest';
import { MedicalEventSource } from '../domain/safety';
import type {
  AiEventDto,
  AiHeartbeatDto,
} from '../presentation/dto/ai-gateway.dto';
import { toGeoPoint, toVitals } from '../presentation/dto/safety-input.dto';
import { EventIngestionService } from './event-ingestion.service';

class AiContractError extends AppError {
  readonly kind = ErrorKind.CONFLICT;
  constructor(code: string, message: string) {
    super(code, message);
  }
}

@Injectable()
export class AiGatewayService {
  constructor(
    private readonly devices: DeviceRepository,
    private readonly lifecycle: DevicesService,
    private readonly uow: UnitOfWork,
    private readonly ingestion: EventIngestionService,
  ) {}

  async session(id: string) {
    const device = await this.current(id);
    return {
      associationId: device.associationId,
      paired: device.pairedUserId !== null,
      mode: 'ACTIVE' as const,
    };
  }

  heartbeat(id: string, dto: AiHeartbeatDto) {
    return this.uow.run(async () => {
      await this.devices.lock(id);
      const device = await this.current(id, dto.associationId);
      const { associationId: _association, ...health } = dto;
      await this.lifecycle.heartbeat(id, undefined, health);
      return {
        associationId: device.associationId,
        paired: device.pairedUserId !== null,
        mode: 'ACTIVE' as const,
      };
    });
  }

  report(id: string, dto: AiEventDto, now = new Date()) {
    return this.uow.run(async () => {
      await this.devices.lock(id);
      const device = await this.current(id, dto.ai.associationId);
      if (!device.pairedUserId) throw new DeviceNotPairedError();
      const start = new Date(dto.ai.windowStartAt).getTime();
      const end = new Date(dto.ai.windowEndAt).getTime();
      const detected = new Date(dto.detectedAt).getTime();
      if (
        dto.clientEventId !== dto.ai.episodeId ||
        AI_EVENT_TYPES[dto.ai.model] !== dto.type ||
        AI_MODEL_HASHES[dto.ai.model] !== dto.ai.modelSha256 ||
        !Number.isFinite(dto.confidence) ||
        start > end ||
        end > detected ||
        detected - start > 600_000
      ) {
        throw new AiContractError(
          'AI_CONTRACT_INVALID',
          'The model, event type, score or input window is invalid.',
        );
      }
      // Reject evidence recorded before the current pairing, including fresh replays of old queues.
      if (device.pairedAt && start < device.pairedAt.getTime()) {
        throw new AiContractError(
          'AI_ASSOCIATION_EXPIRED',
          'This detection belongs to an earlier pairing.',
        );
      }
      const processingMode: AiDetection['processingMode'] =
        dto.ai.inputKind === 'REPLAY'
          ? 'REPLAY'
          : now.getTime() - detected > AI_MAX_LIVE_AGE_MS
            ? 'DELAYED'
            : 'ACTIVE';
      const { event, incident, duplicate } = await this.ingestion.report(
        {
          userId: device.pairedUserId,
          deviceId: id,
          source: MedicalEventSource.DEVICE,
          type: dto.type,
          clientEventId: dto.clientEventId,
          detectedAt: new Date(dto.detectedAt),
          confidence: dto.confidence ?? null,
          vitals: toVitals(dto.vitals),
          location: toGeoPoint(dto.location),
          detection: { ...dto.ai, processingMode },
        },
        undefined,
        now,
      );
      return {
        eventId: event.id,
        incidentId: incident?.id ?? null,
        duplicate,
        processingMode: event.detection!.processingMode,
      };
    });
  }

  private async current(
    id: string,
    associationId?: string,
  ): Promise<DeviceRecord> {
    const device = await this.devices.findById(id);
    if (!device || device.status !== 'ACTIVE')
      throw new DeviceAuthenticationError();
    if (associationId && device.associationId !== associationId) {
      throw new AiContractError(
        'AI_ASSOCIATION_EXPIRED',
        'Refresh the device association before acquiring new data.',
      );
    }
    return device;
  }
}
