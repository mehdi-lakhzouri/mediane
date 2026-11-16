-- Every in-cabin unit is active: live AI detections may open incidents.
-- Replayed and delayed detections are still only recorded (decided per event).
ALTER TABLE "vehicle_devices" DROP CONSTRAINT "vehicle_devices_aiMode_check";
ALTER TABLE "vehicle_devices" DROP COLUMN "aiMode";
