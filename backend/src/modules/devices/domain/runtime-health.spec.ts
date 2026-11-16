import { monitoringState, type RuntimeHealth } from './runtime-health';

const runtime: RuntimeHealth = {
  runtimeVersion: '0.1.0',
  bootId: '00000000-0000-4000-8000-000000000001',
  queueDepth: 0,
  cardiac: 'READY',
  seizure: 'READY',
  stroke: 'READY',
};

describe('monitoring coverage', () => {
  const now = new Date('2026-11-15T10:00:00Z');
  const device = {
    status: 'ACTIVE',
    lastSeenAt: now,
    runtimeHealth: runtime,
  };
  it('does not interpret a heartbeat without model health as readiness', () => {
    expect(
      monitoringState({ ...device, runtimeHealth: null }, now).status,
    ).toBe('UNAVAILABLE');
    expect(monitoringState(null, now).online).toBe(false);
  });
  it('invalidates coverage when heartbeats stop or credentials are revoked', () => {
    expect(
      monitoringState(device, new Date(now.getTime() + 120001)).status,
    ).toBe('UNAVAILABLE');
    expect(monitoringState({ ...device, status: 'REVOKED' }, now).online).toBe(
      false,
    );
  });
  it('separates model warmup and degradation from connectivity', () => {
    expect(monitoringState(device, now).status).toBe('READY');
    expect(
      monitoringState(
        { ...device, runtimeHealth: { ...runtime, cardiac: 'WARMING_UP' } },
        now,
      ).status,
    ).toBe('WARMING_UP');
    expect(
      monitoringState(
        { ...device, runtimeHealth: { ...runtime, stroke: 'ERROR' } },
        now,
      ).status,
    ).toBe('DEGRADED');
  });
});
