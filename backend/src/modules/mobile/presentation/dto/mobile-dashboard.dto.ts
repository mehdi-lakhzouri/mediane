import { ApiProperty } from '@nestjs/swagger';
import { IncidentStatus } from '../../../safety/domain/incident';
import {
  MedicalEventSeverity,
  MedicalEventType,
} from '../../../safety/domain/safety';
import { Role } from '../../../users/domain/role';
import {
  DashboardFamilyState,
  SafetyRecommendation,
} from '../../domain/mobile-dashboard';

class DashboardAvatarResponse {
  @ApiProperty({ description: 'Signed URL; expires soon' }) url!: string;
  @ApiProperty({ type: Date }) expiresAt!: Date;
}

class DashboardDriverResponse {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: Object.values(Role) }) role!: Role;
  @ApiProperty({ type: DashboardAvatarResponse, nullable: true })
  avatar!: DashboardAvatarResponse | null;
}

class DashboardSafetyResponse {
  @ApiProperty({
    description: 'Profile complete with the required emergency contacts',
  })
  ready!: boolean;
  @ApiProperty() emergencyContactCount!: number;
  @ApiProperty({
    enum: Object.values(SafetyRecommendation),
    isArray: true,
  })
  recommendations!: SafetyRecommendation[];
}

class DashboardPendingRequestResponse {
  @ApiProperty() familyName!: string;
  @ApiProperty({ type: Date }) expiresAt!: Date;
}

class DashboardFamilyResponse {
  @ApiProperty({ enum: Object.values(DashboardFamilyState) })
  state!: DashboardFamilyState;
  @ApiProperty({ type: String, nullable: true }) name!: string | null;
  @ApiProperty({ type: Number, nullable: true }) memberCount!: number | null;
  @ApiProperty({ type: Number, nullable: true }) maxMembers!: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Owners only: join requests waiting for an answer',
  })
  pendingJoinRequests!: number | null;
  @ApiProperty({ type: DashboardPendingRequestResponse, nullable: true })
  pendingRequest!: DashboardPendingRequestResponse | null;
}

class DashboardSecurityResponse {
  @ApiProperty() mfaEnabled!: boolean;
  @ApiProperty() recoveryCodesLow!: boolean;
}

class DashboardDeviceResponse {
  @ApiProperty({ description: 'An in-cabin unit is paired with me' })
  paired!: boolean;
  @ApiProperty({ description: 'The unit reported in the last 2 minutes' })
  online!: boolean;
  @ApiProperty({ type: Date, nullable: true }) lastSeenAt!: Date | null;
}

class DashboardActiveIncidentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: Object.values(IncidentStatus) })
  status!: IncidentStatus;
  @ApiProperty({ enum: Object.values(MedicalEventSeverity) })
  severity!: MedicalEventSeverity;
  @ApiProperty({ enum: Object.values(MedicalEventType) })
  triggerType!: MedicalEventType;
  @ApiProperty({ type: Date, nullable: true }) respondBy!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) escalatedAt!: Date | null;
}

class DashboardLatestEventResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: Object.values(MedicalEventType) })
  type!: MedicalEventType;
  @ApiProperty({ enum: Object.values(MedicalEventSeverity) })
  severity!: MedicalEventSeverity;
  @ApiProperty({ type: Date }) detectedAt!: Date;
  @ApiProperty({
    enum: Object.values(IncidentStatus),
    nullable: true,
    description: 'Outcome of its incident; null for warnings',
  })
  incidentStatus!: IncidentStatus | null;
  @ApiProperty({ description: 'Emergency contacts or family were called' })
  contactsAlerted!: boolean;
}

class DashboardMonitoringResponse {
  @ApiProperty({ type: DashboardDeviceResponse })
  device!: DashboardDeviceResponse;
  @ApiProperty({ type: DashboardActiveIncidentResponse, nullable: true })
  activeIncident!: DashboardActiveIncidentResponse | null;
  @ApiProperty({ type: DashboardLatestEventResponse, nullable: true })
  latestEvent!: DashboardLatestEventResponse | null;
}

class DashboardNotificationsResponse {
  @ApiProperty({ description: 'Unread notifications (bell badge)' })
  unread!: number;
}

class DashboardFeaturesResponse {
  @ApiProperty({ example: true }) medicalEvents!: boolean;
  @ApiProperty({ example: true }) emergencyAlerts!: boolean;
  @ApiProperty({ example: true }) notifications!: boolean;
  @ApiProperty({ example: false }) vehicleTelemetry!: boolean;
}

export class MobileDashboardResponse {
  @ApiProperty({ type: Date }) serverTime!: Date;
  @ApiProperty({ type: DashboardDriverResponse })
  driver!: DashboardDriverResponse;
  @ApiProperty({ type: DashboardSafetyResponse })
  safety!: DashboardSafetyResponse;
  @ApiProperty({ type: DashboardFamilyResponse })
  family!: DashboardFamilyResponse;
  @ApiProperty({ type: DashboardSecurityResponse })
  security!: DashboardSecurityResponse;
  @ApiProperty({ type: DashboardMonitoringResponse })
  monitoring!: DashboardMonitoringResponse;
  @ApiProperty({ type: DashboardNotificationsResponse })
  notifications!: DashboardNotificationsResponse;
  @ApiProperty({
    type: DashboardFeaturesResponse,
    description: 'Capabilities available today; hide the rest',
  })
  features!: DashboardFeaturesResponse;
}
