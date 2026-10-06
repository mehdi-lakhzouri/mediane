import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DevicesModule } from '../devices/devices.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmergencyDispatcher } from './application/emergency-dispatcher';
import { EscalationService } from './application/escalation.service';
import { EventIngestionService } from './application/event-ingestion.service';
import { IncidentResponseService } from './application/incident-response.service';
import { SafetyQueryService } from './application/safety-query.service';
import { SafetyRetentionService } from './application/safety-retention.service';
import { SafetyScheduler } from './application/safety-scheduler';
import { SafetyWorker } from './application/safety.worker';
import {
  EmergencyContactChannel,
  FamilyAlertChannel,
  SafetyDirectory,
} from './domain/notification';
import {
  IncidentRepository,
  MedicalEventRepository,
} from './domain/safety.repository';
import { EmailFamilyChannel } from './infrastructure/email-family.channel';
import { LoggingContactChannel } from './infrastructure/logging-contact.channel';
import { PrismaIncidentRepository } from './infrastructure/prisma-incident.repository';
import { PrismaMedicalEventRepository } from './infrastructure/prisma-medical-event.repository';
import { PrismaSafetyDirectory } from './infrastructure/prisma-safety.directory';
import { DeviceSafetyController } from './presentation/device-safety.controller';
import { SafetyController } from './presentation/safety.controller';

/**
 * Medical events, incidents and emergency escalation. Depends on devices
 * (signed unit requests) and reads profiles and families through its own
 * directory; nothing depends back on it except the mobile dashboard.
 */
@Module({
  imports: [DevicesModule, AuditModule, MailModule, NotificationsModule],
  controllers: [SafetyController, DeviceSafetyController],
  providers: [
    EventIngestionService,
    IncidentResponseService,
    SafetyQueryService,
    EscalationService,
    EmergencyDispatcher,
    SafetyRetentionService,
    SafetyWorker,
    { provide: SafetyScheduler, useExisting: SafetyWorker },
    { provide: MedicalEventRepository, useClass: PrismaMedicalEventRepository },
    { provide: IncidentRepository, useClass: PrismaIncidentRepository },
    { provide: SafetyDirectory, useClass: PrismaSafetyDirectory },
    // Swap for an SMS or voice provider without touching escalation.
    { provide: EmergencyContactChannel, useClass: LoggingContactChannel },
    { provide: FamilyAlertChannel, useClass: EmailFamilyChannel },
  ],
  exports: [
    SafetyQueryService,
    EscalationService,
    SafetyRetentionService,
    EventIngestionService,
  ],
})
export class SafetyModule {}
