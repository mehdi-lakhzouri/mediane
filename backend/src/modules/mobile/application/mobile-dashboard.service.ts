import { Injectable } from '@nestjs/common';
import { SessionInvalidError } from '../../auth/domain/auth.errors';
import { DevicesService } from '../../devices/application/devices.service';
import type { DeviceRecord } from '../../devices/domain/device';
import {
  MONITORING_FRESHNESS_MS,
  monitoringState,
} from '../../devices/domain/runtime-health';
import { FamiliesService } from '../../families/application/families.service';
import { FamilyRole } from '../../families/domain/family';
import { MfaService } from '../../mfa/application/mfa.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { ProfilesService } from '../../profiles/application/profiles.service';
import { SafetyQueryService } from '../../safety/application/safety-query.service';
import { MIN_EMERGENCY_CONTACTS } from '../../profiles/domain/profile-rules';
import { UserRepository } from '../../users/domain/user.repository';
import {
  type DashboardFeatures,
  DashboardFamilyState,
  type DashboardMonitoring,
  type MobileDashboard,
  SafetyRecommendation,
} from '../domain/mobile-dashboard';

const FEATURES: DashboardFeatures = {
  medicalEvents: true,
  emergencyAlerts: true,
  notifications: true,
  vehicleTelemetry: false,
};

/** A unit that reported within this window is shown as online. */
const DEVICE_ONLINE_WINDOW_MS = MONITORING_FRESHNESS_MS;

function deviceState(
  device: DeviceRecord | null,
  now: Date,
): DashboardMonitoring['device'] {
  const lastSeenAt = device?.lastSeenAt ?? null;
  return {
    paired: device !== null,
    online:
      lastSeenAt !== null &&
      now.getTime() - lastSeenAt.getTime() <= DEVICE_ONLINE_WINDOW_MS,
    lastSeenAt,
  };
}

/**
 * One read for the mobile home screen, so the app does not fan out across
 * services. Only the caller's own data is aggregated.
 */
@Injectable()
export class MobileDashboardService {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: ProfilesService,
    private readonly families: FamiliesService,
    private readonly mfa: MfaService,
    private readonly devices: DevicesService,
    private readonly safety: SafetyQueryService,
    private readonly inbox: NotificationsService,
  ) {}

  async getDashboard(userId: string): Promise<MobileDashboard> {
    const [user, profile, mine, mfa, device, incident, latest, unread] =
      await Promise.all([
        this.users.findById(userId),
        this.profiles.getOwnProfile(userId),
        this.families.getMine(userId),
        this.mfa.getStatus(userId),
        this.devices.pairedWith(userId),
        this.safety.findActive(userId),
        this.safety.latestEvent(userId),
        this.inbox.unreadCount(userId),
      ]);
    const now = new Date();
    if (!user) throw new SessionInvalidError();

    const family = mine.family;
    const familyState = family
      ? family.myRole === FamilyRole.OWNER
        ? DashboardFamilyState.OWNER
        : DashboardFamilyState.MEMBER
      : mine.pendingRequest
        ? DashboardFamilyState.REQUEST_PENDING
        : DashboardFamilyState.NONE;

    const contactCount = profile.emergencyContacts.length;
    const recommendations: SafetyRecommendation[] = [];
    if (!mfa.enabled) {
      recommendations.push(SafetyRecommendation.ENABLE_TWO_STEP);
    }
    if (mfa.enabled && mfa.recoveryCodesLow) {
      recommendations.push(SafetyRecommendation.REGENERATE_RECOVERY_CODES);
    }
    if (familyState === DashboardFamilyState.NONE) {
      recommendations.push(SafetyRecommendation.JOIN_OR_CREATE_FAMILY);
    }

    return {
      serverTime: now,
      driver: {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: profile.avatar,
      },
      safety: {
        ready:
          profile.completedAt !== null &&
          contactCount >= MIN_EMERGENCY_CONTACTS,
        emergencyContactCount: contactCount,
        recommendations,
      },
      family: {
        state: familyState,
        name: family?.name ?? null,
        memberCount: family?.members.length ?? null,
        maxMembers: family?.maxMembers ?? null,
        pendingJoinRequests: family?.pendingRequestCount ?? null,
        pendingRequest: mine.pendingRequest
          ? {
              familyName: mine.pendingRequest.familyName,
              expiresAt: mine.pendingRequest.expiresAt,
            }
          : null,
      },
      security: {
        mfaEnabled: mfa.enabled,
        recoveryCodesLow: mfa.recoveryCodesLow,
      },
      monitoring: {
        runtime: monitoringState(device, now),
        device: deviceState(device, now),
        activeIncident: incident
          ? {
              id: incident.id,
              status: incident.status,
              severity: incident.severity,
              triggerType: incident.triggerType,
              respondBy: incident.respondBy,
              escalatedAt: incident.escalatedAt,
            }
          : null,
        latestEvent: latest
          ? {
              id: latest.event.id,
              type: latest.event.type,
              processingMode: latest.event.detection?.processingMode ?? null,
              severity: latest.event.severity,
              detectedAt: latest.event.detectedAt,
              incidentStatus: latest.incident?.status ?? null,
              contactsAlerted: latest.incident?.escalatedAt != null,
            }
          : null,
      },
      notifications: { unread },
      features: { ...FEATURES },
    };
  }
}
