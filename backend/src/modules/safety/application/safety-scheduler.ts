/**
 * Lets request handlers ask for escalation work to run now (an SOS should
 * not wait for the next tick). A no-op when the worker is disabled.
 */
export abstract class SafetyScheduler {
  abstract nudge(): void;
}
