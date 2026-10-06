export const MedicalEventType = {
  HEART_RHYTHM: 'HEART_RHYTHM',
  DROWSINESS: 'DROWSINESS',
  SEIZURE: 'SEIZURE',
  STROKE: 'STROKE',
  CARDIAC_ARREST: 'CARDIAC_ARREST',
  /** Raised by the driver (app or cabin button), not detected. */
  SOS: 'SOS',
} as const;
export type MedicalEventType =
  (typeof MedicalEventType)[keyof typeof MedicalEventType];

export const MedicalEventSeverity = {
  /** In-app warning only; never escalates. */
  WARNING: 'WARNING',
  URGENT: 'URGENT',
  CRITICAL: 'CRITICAL',
} as const;
export type MedicalEventSeverity =
  (typeof MedicalEventSeverity)[keyof typeof MedicalEventSeverity];

export const MedicalEventSource = {
  DEVICE: 'DEVICE',
  DRIVER: 'DRIVER',
} as const;
export type MedicalEventSource =
  (typeof MedicalEventSource)[keyof typeof MedicalEventSource];

/** Who answered or closed an incident. */
export const IncidentActorChannel = {
  APP: 'APP',
  DEVICE: 'DEVICE',
  SYSTEM: 'SYSTEM',
} as const;
export type IncidentActorChannel =
  (typeof IncidentActorChannel)[keyof typeof IncidentActorChannel];

/** Readings that come with a detection. All optional, all bounded. */
export interface Vitals {
  heartRateBpm?: number;
  spo2Percent?: number;
  respiratoryRateBpm?: number;
  /** Share of time the eyes were closed over the detection window (PERCLOS). */
  eyeClosurePercent?: number;
  rhythm?: HeartRhythm;
}

export const HeartRhythm = {
  NORMAL: 'NORMAL',
  ATRIAL_FIBRILLATION: 'ATRIAL_FIBRILLATION',
  BRADYCARDIA: 'BRADYCARDIA',
  TACHYCARDIA: 'TACHYCARDIA',
  VENTRICULAR_TACHYCARDIA: 'VENTRICULAR_TACHYCARDIA',
  VENTRICULAR_FIBRILLATION: 'VENTRICULAR_FIBRILLATION',
  ASYSTOLE: 'ASYSTOLE',
  IRREGULAR: 'IRREGULAR',
} as const;
export type HeartRhythm = (typeof HeartRhythm)[keyof typeof HeartRhythm];

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}

const SEVERITY_BY_TYPE: Record<MedicalEventType, MedicalEventSeverity> = {
  HEART_RHYTHM: MedicalEventSeverity.URGENT,
  DROWSINESS: MedicalEventSeverity.WARNING,
  SEIZURE: MedicalEventSeverity.CRITICAL,
  STROKE: MedicalEventSeverity.CRITICAL,
  CARDIAC_ARREST: MedicalEventSeverity.CRITICAL,
  SOS: MedicalEventSeverity.CRITICAL,
};

const SEVERITY_RANK: Record<MedicalEventSeverity, number> = {
  WARNING: 0,
  URGENT: 1,
  CRITICAL: 2,
};

/**
 * The server decides severity from the event type; a sender cannot make an
 * event more or less urgent than its type.
 */
export const SeverityPolicy = {
  severityOf(type: MedicalEventType): MedicalEventSeverity {
    return SEVERITY_BY_TYPE[type];
  },

  /** Whether an event of this severity needs an answer (opens an incident). */
  opensIncident(severity: MedicalEventSeverity): boolean {
    return severity !== MedicalEventSeverity.WARNING;
  },

  isMoreSevere(a: MedicalEventSeverity, b: MedicalEventSeverity): boolean {
    return SEVERITY_RANK[a] > SEVERITY_RANK[b];
  },

  /** Seconds the driver has to answer before help is called. */
  responseSeconds(
    severity: MedicalEventSeverity,
    windows: { criticalResponseSeconds: number; urgentResponseSeconds: number },
  ): number | null {
    switch (severity) {
      case MedicalEventSeverity.CRITICAL:
        return windows.criticalResponseSeconds;
      case MedicalEventSeverity.URGENT:
        return windows.urgentResponseSeconds;
      case MedicalEventSeverity.WARNING:
        return null;
    }
  },
} as const;

export const SafetyLimits = {
  CLIENT_EVENT_ID_MAX_LENGTH: 64,
  /** Older detections are refused: escalating on stale data helps no one. */
  MAX_EVENT_AGE_HOURS: 24,
  /** Device clocks drift; a detection slightly in the future is tolerated. */
  MAX_CLOCK_SKEW_SECONDS: 300,
} as const;
