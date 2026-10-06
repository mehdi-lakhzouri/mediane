import { Inject, Injectable } from '@nestjs/common';
import { mobileConfig, type MobileConfig } from '../../../config/mobile.config';
import {
  AVATAR_MAX_UPLOAD_BYTES,
  AVATAR_MIN_SIDE_PX,
} from '../../profiles/application/avatar-image-processor';
import {
  DRIVER_MIN_AGE,
  MAX_EMERGENCY_CONTACTS,
  MIN_EMERGENCY_CONTACTS,
} from '../../profiles/domain/profile-rules';
import type { MobileBootstrap } from '../domain/mobile-bootstrap';

@Injectable()
export class MobileBootstrapService {
  constructor(
    @Inject(mobileConfig.KEY) private readonly config: MobileConfig,
  ) {}

  getConfiguration(): MobileBootstrap {
    return {
      minimumSupportedVersion: this.config.minimumSupportedVersion,
      latestVersion: this.config.latestVersion,
      maintenance: this.config.maintenance,
      maintenanceMessage: this.config.maintenanceMessage,
      maintenanceEndsAt: this.config.maintenanceEndsAt,
      termsVersion: this.config.termsVersion,
      privacyVersion: this.config.privacyVersion,
      termsUrl: this.config.termsUrl,
      privacyUrl: this.config.privacyUrl,
      supportUrl: this.config.supportUrl,
      features: { ...this.config.features },
      profileRules: {
        driverMinimumAge: DRIVER_MIN_AGE,
        minEmergencyContacts: MIN_EMERGENCY_CONTACTS,
        maxEmergencyContacts: MAX_EMERGENCY_CONTACTS,
        avatarMaxBytes: AVATAR_MAX_UPLOAD_BYTES,
        avatarMinSidePx: AVATAR_MIN_SIDE_PX,
      },
    };
  }
}
