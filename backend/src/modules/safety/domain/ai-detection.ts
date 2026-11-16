export interface AiDetection {
  schemaVersion: 1;
  associationId: string;
  episodeId: string;
  inputKind: 'REPLAY' | 'SENSOR';
  model: 'Cardiac' | 'Seizure' | 'Stroke';
  modelSha256: string;
  featureVersion: '1';
  decisionVersion: '1';
  windowStartAt: string;
  windowEndAt: string;
  /**
   * ACTIVE: a live detection, may open an incident. REPLAY and DELAYED are
   * only recorded. SHADOW only appears on events stored before every unit
   * became active.
   */
  processingMode: 'ACTIVE' | 'REPLAY' | 'DELAYED' | 'SHADOW';
}

/** Live freshness is distinct from the 24-hour history acceptance limit. */
export const AI_MAX_LIVE_AGE_MS = 60_000;

export const AI_EVENT_TYPES = {
  Cardiac: 'CARDIAC_EMERGENCY',
  Seizure: 'SEIZURE',
  Stroke: 'STROKE',
} as const;
