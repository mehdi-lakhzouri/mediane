import type { AdminDevice } from "../../../lib/api/admin-devices";

export type DetectorState =
  "READY" | "WARMING_UP" | "DEGRADED" | "ERROR" | "UNAVAILABLE";
export type HealthReason =
  | "ready"
  | "warming"
  | "limited"
  | "offline"
  | "neverSeen"
  | "unpaired"
  | "revoked"
  | "noRuntime"
  | "refreshFailed";
export const DETECTORS = ["cardiac", "seizure", "stroke"] as const;
const STATES: readonly string[] = [
  "READY",
  "WARMING_UP",
  "DEGRADED",
  "ERROR",
  "UNAVAILABLE",
];

export function detectorState(value: string | undefined): DetectorState {
  return STATES.includes(value ?? "")
    ? (value as DetectorState)
    : "UNAVAILABLE";
}

export function deviceHealth(device: AdminDevice, now: number, failed = false) {
  const heartbeat = Date.parse(device.lastSeenAt ?? "");
  const online =
    !failed &&
    device.status === "ACTIVE" &&
    Number.isFinite(heartbeat) &&
    heartbeat <= now + 30_000 &&
    now - heartbeat <= 120_000;
  const valid = online && !!device.pairedUserId && !!device.runtimeHealth;
  const detectors = Object.fromEntries(
    DETECTORS.map((key) => [
      key,
      valid ? detectorState(device.runtimeHealth?.[key]) : "UNAVAILABLE",
    ]),
  ) as Record<(typeof DETECTORS)[number], DetectorState>;
  const values = Object.values(detectors);
  const state: DetectorState = !valid
    ? "UNAVAILABLE"
    : values.every((value) => value === "READY")
      ? "READY"
      : values.some((value) =>
            ["ERROR", "DEGRADED", "UNAVAILABLE"].includes(value),
          )
        ? "DEGRADED"
        : "WARMING_UP";
  const reason: HealthReason = failed
    ? "refreshFailed"
    : device.status === "REVOKED"
      ? "revoked"
      : !device.pairedUserId
        ? "unpaired"
        : !Number.isFinite(heartbeat)
          ? "neverSeen"
          : !online
            ? "offline"
            : !device.runtimeHealth
              ? "noRuntime"
              : state === "READY"
                ? "ready"
                : state === "WARMING_UP"
                  ? "warming"
                  : "limited";
  return {
    online,
    valid,
    state,
    reason,
    detectors,
    queue: online ? (device.runtimeHealth?.queueDepth ?? null) : null,
  };
}
