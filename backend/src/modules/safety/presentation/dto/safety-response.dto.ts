import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentStatus, IncidentTimelineKind } from '../../domain/incident';
import {
  NotificationChannel,
  NotificationKind,
  NotificationRecipientType,
  NotificationStatus,
} from '../../domain/notification';
import {
  HeartRhythm,
  IncidentActorChannel,
  MedicalEventSeverity,
  MedicalEventSource,
  MedicalEventType,
} from '../../domain/safety';

export class LocationResponse {
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiProperty({ type: Number, nullable: true }) accuracyM!: number | null;
}

export class VitalsResponse {
  @ApiPropertyOptional() heartRateBpm?: number;
  @ApiPropertyOptional() spo2Percent?: number;
  @ApiPropertyOptional() respiratoryRateBpm?: number;
  @ApiPropertyOptional() eyeClosurePercent?: number;
  @ApiPropertyOptional({ enum: Object.values(HeartRhythm) })
  rhythm?: HeartRhythm;
}

/** List row: what happened and when, without readings or location. */
export class MedicalEventSummaryResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: Object.values(MedicalEventType) })
  type!: MedicalEventType;
  @ApiProperty({ enum: Object.values(MedicalEventSeverity) })
  severity!: MedicalEventSeverity;
  @ApiProperty({ enum: Object.values(MedicalEventSource) })
  source!: MedicalEventSource;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Detector confidence 0..1. Null for SOS.',
  })
  confidence!: number | null;
  @ApiProperty({ description: 'Unit clock' }) detectedAt!: Date;
  @ApiProperty({ description: 'Server clock' }) receivedAt!: Date;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  incidentId!: string | null;
}

export class MedicalEventResponse extends MedicalEventSummaryResponse {
  @ApiProperty({ type: VitalsResponse, nullable: true })
  vitals!: VitalsResponse | null;
  @ApiProperty({ type: LocationResponse, nullable: true })
  location!: LocationResponse | null;
}

export class IncidentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: Object.values(IncidentStatus) })
  status!: IncidentStatus;
  @ApiProperty({ enum: Object.values(MedicalEventSeverity) })
  severity!: MedicalEventSeverity;
  @ApiProperty({ enum: Object.values(MedicalEventType) })
  triggerType!: MedicalEventType;
  @ApiProperty() openedAt!: Date;
  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'Help is called when this passes without an answer.',
  })
  respondBy!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) acknowledgedAt!: Date | null;
  @ApiProperty({
    enum: Object.values(IncidentActorChannel),
    nullable: true,
  })
  acknowledgedVia!: IncidentActorChannel | null;
  @ApiProperty({ type: Date, nullable: true }) escalatedAt!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) resolvedAt!: Date | null;
  @ApiProperty({
    enum: Object.values(IncidentActorChannel),
    nullable: true,
  })
  resolvedVia!: IncidentActorChannel | null;
  @ApiProperty({
    type: LocationResponse,
    nullable: true,
    description: 'Only while the incident is open.',
  })
  location!: LocationResponse | null;
}

export class TimelineEntryResponse {
  @ApiProperty({ enum: Object.values(IncidentTimelineKind) })
  kind!: IncidentTimelineKind;
  @ApiProperty() at!: Date;
  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
  })
  detail!: Record<string, unknown> | null;
}

export class NotificationResponse {
  @ApiProperty({ enum: Object.values(NotificationKind) })
  kind!: NotificationKind;
  @ApiProperty({ enum: Object.values(NotificationRecipientType) })
  recipientType!: NotificationRecipientType;
  @ApiProperty() recipientName!: string;
  @ApiProperty({ type: Number, nullable: true }) priority!: number | null;
  @ApiProperty({ enum: Object.values(NotificationChannel) })
  channel!: NotificationChannel;
  @ApiProperty({ enum: Object.values(NotificationStatus) })
  status!: NotificationStatus;
  @ApiProperty() attemptedAt!: Date;
}

export class IncidentDetailResponse {
  @ApiProperty({ description: 'For countdown sync with the device clock' })
  serverTime!: Date;
  @ApiProperty({ type: IncidentResponse }) incident!: IncidentResponse;
  @ApiProperty({ type: [MedicalEventSummaryResponse] })
  events!: MedicalEventSummaryResponse[];
  @ApiProperty({ type: [TimelineEntryResponse] })
  timeline!: TimelineEntryResponse[];
  @ApiProperty({ type: [NotificationResponse] })
  notifications!: NotificationResponse[];
}

class FamilyIncidentMemberResponse {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
}

/** What a family member may see: who, status and times. Never the cause. */
export class FamilyIncidentResponse {
  @ApiProperty({ format: 'uuid' }) incidentId!: string;
  @ApiProperty({ type: FamilyIncidentMemberResponse })
  member!: FamilyIncidentMemberResponse;
  @ApiProperty({ enum: Object.values(IncidentStatus) })
  status!: IncidentStatus;
  @ApiProperty() openedAt!: Date;
  @ApiProperty({ type: Date, nullable: true }) escalatedAt!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) resolvedAt!: Date | null;
  @ApiProperty({
    type: LocationResponse,
    nullable: true,
    description: 'Only while help is being called.',
  })
  location!: LocationResponse | null;
}

/** A unit gets ids back, never medical data. */
export class DeviceEventReceiptResponse {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  incidentId!: string | null;
  @ApiProperty({
    enum: Object.values(IncidentStatus),
    nullable: true,
    description: 'Lets the unit show its countdown or "help is coming".',
  })
  incidentStatus!: IncidentStatus | null;
  @ApiProperty({ type: Date, nullable: true }) respondBy!: Date | null;
  @ApiProperty({ description: 'The event had already been received.' })
  duplicate!: boolean;
}

export class DeviceAcknowledgeResponse {
  @ApiProperty({ format: 'uuid' }) incidentId!: string;
  @ApiProperty({ enum: Object.values(IncidentStatus) })
  status!: IncidentStatus;
}
