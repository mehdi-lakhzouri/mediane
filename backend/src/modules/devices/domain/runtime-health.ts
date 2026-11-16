export const DETECTOR_STATUSES = [
  'WARMING_UP',
  'READY',
  'DEGRADED',
  'ERROR',
  'UNAVAILABLE',
] as const;
export type DetectorStatus = (typeof DETECTOR_STATUSES)[number];

/** Operational data only: never include predictions, readings, or medical labels. */
export interface RuntimeHealth {
  runtimeVersion: string;
  bootId: string;
  queueDepth: number;
  cardiac: DetectorStatus;
  seizure: DetectorStatus;
  stroke: DetectorStatus;
}

export const MONITORING_FRESHNESS_MS = 120_000;

export function monitoringState(
  device: {
    status: string;
    lastSeenAt: Date | null;
    runtimeHealth: RuntimeHealth | null;
  } | null,
  now = new Date(),
) {
  const online =
    device?.status === 'ACTIVE' &&
    device.lastSeenAt !== null &&
    now.getTime() - device.lastSeenAt.getTime() <= MONITORING_FRESHNESS_MS;
  const runtime = online ? (device?.runtimeHealth ?? null) : null;
  const states = runtime
    ? [runtime.cardiac, runtime.seizure, runtime.stroke]
    : [];
  const status =
    !online || !runtime
      ? 'UNAVAILABLE'
      : states.every((s) => s === 'READY')
        ? 'READY'
        : states.some(
              (s) => s === 'ERROR' || s === 'DEGRADED' || s === 'UNAVAILABLE',
            )
          ? 'DEGRADED'
          : 'WARMING_UP';
  return {
    status,
    online,
    // Detections always raise alerts; kept for installed app versions.
    mode: 'ACTIVE' as const,
    lastSeenAt: device?.lastSeenAt ?? null,
    runtime,
  };
}
