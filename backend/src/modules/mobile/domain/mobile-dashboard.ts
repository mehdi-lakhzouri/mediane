import type { IncidentStatus } from '../../safety/domain/incident';
import type {
  MedicalEventSeverity,
  MedicalEventType,
} from '../../safety/domain/safety';
import type { Role } from '../../users/domain/role';

/** Where the driver stands with families, from the driver's point of view. */
export const DashboardFamilyState = {
  NONE: 'NONE',
  REQUEST_PENDING: 'REQUEST_PENDING',
  MEMBER: 'MEMBER',
  OWNER: 'OWNER',
} as const;
export type DashboardFamilyState =
  (typeof DashboardFamilyState)[keyof typeof DashboardFamilyState];

/** Things the driver could do to be better protected; never blocking. */
export const SafetyRecommendation = {
  ENABLE_TWO_STEP: 'ENABLE_TWO_STEP',
  REGENERATE_RECOVERY_CODES: 'REGENERATE_RECOVERY_CODES',
  JOIN_OR_CREATE_FAMILY: 'JOIN_OR_CREATE_FAMILY',
} as const;
export type SafetyRecommendation =
  (typeof SafetyRecommendation)[keyof typeof SafetyRecommendation];

/**
 * Capabilities the backend actually provides today. Vehicle telemetry ships
 * later; until then the app hides that part of the home screen.
 */
export interface DashboardFeatures {
  medicalEvents: boolean;
  emergencyAlerts: boolean;
  notifications: boolean;
  vehicleTelemetry: boolean;
}

export interface MobileDashboard {
  serverTime: Date;
  driver: {
    userId: string;
    firstName: string;
    lastName: string;
    role: Role;
    avatar: { url: string; expiresAt: Date } | null;
  };
  safety: {
    /** Profile complete with the required emergency contacts. */
    ready: boolean;
    emergencyContactCount: number;
    recommendations: SafetyRecommendation[];
  };
  family: {
    state: DashboardFamilyState;
    name: string | null;
    memberCount: number | null;
    maxMembers: number | null;
    /** Owners only: join requests waiting for an answer. */
    pendingJoinRequests: number | null;
    /** The driver's own request, while waiting for an owner. */
    pendingRequest: { familyName: string; expiresAt: Date } | null;
  };
  security: { mfaEnabled: boolean; recoveryCodesLow: boolean };
  monitoring: DashboardMonitoring;
  /** Badge on the bell. */
  notifications: { unread: number };
  features: DashboardFeatures;
}

/** Live safety state: the in-cabin unit, an open incident, the last event. */
export interface DashboardMonitoring {
  device: {
    paired: boolean;
    /** Heard from within the online window. */
    online: boolean;
    lastSeenAt: Date | null;
  };
  activeIncident: {
    id: string;
    status: IncidentStatus;
    severity: MedicalEventSeverity;
    triggerType: MedicalEventType;
    respondBy: Date | null;
    escalatedAt: Date | null;
  } | null;
  latestEvent: {
    id: string;
    type: MedicalEventType;
    severity: MedicalEventSeverity;
    detectedAt: Date;
    /** Outcome of the incident the event belongs to; null for warnings. */
    incidentStatus: IncidentStatus | null;
    /** Whether emergency contacts or family were called. */
    contactsAlerted: boolean;
  } | null;
}
