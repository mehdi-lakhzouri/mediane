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
  processingMode: 'ACTIVE' | 'SHADOW' | 'REPLAY' | 'DELAYED';
}

/** Live freshness is distinct from the 24-hour history acceptance limit. */
export const AI_MAX_LIVE_AGE_MS = 60_000;

export const AI_EVENT_TYPES = {
  Cardiac: 'CARDIAC_EMERGENCY',
  Seizure: 'SEIZURE',
  Stroke: 'STROKE',
} as const;
