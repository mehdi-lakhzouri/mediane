ALTER TYPE "MedicalEventType" ADD VALUE 'CARDIAC_EMERGENCY';

ALTER TABLE "vehicle_devices"
  ADD COLUMN "associationId" UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "aiMode" VARCHAR(10) NOT NULL DEFAULT 'SHADOW',
  ADD COLUMN "runtimeHealth" JSONB;
ALTER TABLE "vehicle_devices" ADD CONSTRAINT "vehicle_devices_aiMode_check"
  CHECK ("aiMode" IN ('SHADOW', 'ACTIVE'));

ALTER TABLE "medical_events"
  ADD COLUMN "detection" JSONB,
  ADD COLUMN "payloadHash" VARCHAR(64);
CREATE UNIQUE INDEX "medical_events_deviceId_clientEventId_key"
  ON "medical_events"("deviceId", "clientEventId");
