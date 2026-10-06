-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "MedicalEventType" AS ENUM ('HEART_RHYTHM', 'DROWSINESS', 'SEIZURE', 'STROKE', 'CARDIAC_ARREST', 'SOS');

-- CreateEnum
CREATE TYPE "MedicalEventSeverity" AS ENUM ('WARNING', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MedicalEventSource" AS ENUM ('DEVICE', 'DRIVER');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('AWAITING_RESPONSE', 'ESCALATED', 'RESOLVED', 'FALSE_ALARM');

-- CreateEnum
CREATE TYPE "IncidentActorChannel" AS ENUM ('APP', 'DEVICE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "IncidentTimelineKind" AS ENUM ('OPENED', 'EVENT_ADDED', 'ACKNOWLEDGED', 'ESCALATED', 'NOTIFIED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('ALERT', 'ALL_CLEAR');

-- CreateEnum
CREATE TYPE "NotificationRecipientType" AS ENUM ('EMERGENCY_CONTACT', 'FAMILY_MEMBER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('LOG', 'EMAIL', 'SMS', 'VOICE', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "AuditActorType" ADD VALUE 'DEVICE';

-- CreateTable
CREATE TABLE "vehicle_devices" (
    "id" UUID NOT NULL,
    "serialNumber" VARCHAR(64) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "secretEnc" VARCHAR(255) NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "pairedUserId" UUID,
    "pairedAt" TIMESTAMP(3),
    "firmwareVersion" VARCHAR(50),
    "lastSeenAt" TIMESTAMP(3),
    "secretRotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_request_nonces" (
    "deviceId" UUID NOT NULL,
    "nonce" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_request_nonces_pkey" PRIMARY KEY ("deviceId","nonce")
);

-- CreateTable
CREATE TABLE "medical_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" UUID,
    "incidentId" UUID,
    "source" "MedicalEventSource" NOT NULL,
    "type" "MedicalEventType" NOT NULL,
    "severity" "MedicalEventSeverity" NOT NULL,
    "clientEventId" VARCHAR(64) NOT NULL,
    "confidence" DOUBLE PRECISION,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vitals" JSONB,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationAccuracyM" DOUBLE PRECISION,

    CONSTRAINT "medical_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "IncidentStatus" NOT NULL,
    "severity" "MedicalEventSeverity" NOT NULL,
    "triggerType" "MedicalEventType" NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondBy" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedVia" "IncidentActorChannel",
    "escalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedVia" "IncidentActorChannel",
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationAccuracyM" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_timeline" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "kind" "IncidentTimelineKind" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detail" JSONB,

    CONSTRAINT "incident_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_notifications" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "recipientType" "NotificationRecipientType" NOT NULL,
    "recipientUserId" UUID,
    "recipientName" VARCHAR(200) NOT NULL,
    "priority" INTEGER,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "error" VARCHAR(200),
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_devices_serialNumber_key" ON "vehicle_devices"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_devices_pairedUserId_key" ON "vehicle_devices"("pairedUserId");

-- CreateIndex
CREATE INDEX "vehicle_devices_status_idx" ON "vehicle_devices"("status");

-- CreateIndex
CREATE INDEX "device_request_nonces_expiresAt_idx" ON "device_request_nonces"("expiresAt");

-- CreateIndex
CREATE INDEX "medical_events_userId_detectedAt_idx" ON "medical_events"("userId", "detectedAt");

-- CreateIndex
CREATE INDEX "medical_events_receivedAt_idx" ON "medical_events"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "medical_events_userId_clientEventId_key" ON "medical_events"("userId", "clientEventId");

-- CreateIndex
CREATE INDEX "incidents_status_respondBy_idx" ON "incidents"("status", "respondBy");

-- CreateIndex
CREATE INDEX "incidents_userId_openedAt_idx" ON "incidents"("userId", "openedAt");

-- CreateIndex
CREATE INDEX "incidents_openedAt_idx" ON "incidents"("openedAt");

-- CreateIndex
CREATE INDEX "incident_timeline_incidentId_at_idx" ON "incident_timeline"("incidentId", "at");

-- CreateIndex
CREATE INDEX "incident_notifications_incidentId_attemptedAt_idx" ON "incident_notifications"("incidentId", "attemptedAt");

-- AddForeignKey
ALTER TABLE "vehicle_devices" ADD CONSTRAINT "vehicle_devices_pairedUserId_fkey" FOREIGN KEY ("pairedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_request_nonces" ADD CONSTRAINT "device_request_nonces_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "vehicle_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "vehicle_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timeline" ADD CONSTRAINT "incident_timeline_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_notifications" ADD CONSTRAINT "incident_notifications_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one active incident per driver: concurrent events for the same
-- driver attach to it instead of opening duplicates (not expressible in Prisma).
CREATE UNIQUE INDEX "incidents_one_active_per_user"
    ON "incidents" ("userId")
    WHERE "status" IN ('AWAITING_RESPONSE', 'ESCALATED');

-- Confidence is a probability.
ALTER TABLE "medical_events"
    ADD CONSTRAINT "medical_events_confidence_range"
    CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));
