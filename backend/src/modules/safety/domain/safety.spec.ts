import {
  IncidentStatus,
  isActiveIncident,
  statusAfterAcknowledge,
  tightenedDeadline,
} from './incident';
import {
  MedicalEventSeverity,
  MedicalEventType,
  SeverityPolicy,
} from './safety';

const windows = { criticalResponseSeconds: 30, urgentResponseSeconds: 60 };

describe('SeverityPolicy', () => {
  it.each([
    [MedicalEventType.CARDIAC_ARREST, MedicalEventSeverity.CRITICAL, 30],
    [MedicalEventType.STROKE, MedicalEventSeverity.CRITICAL, 30],
    [MedicalEventType.SEIZURE, MedicalEventSeverity.CRITICAL, 30],
    [MedicalEventType.SOS, MedicalEventSeverity.CRITICAL, 30],
    [MedicalEventType.HEART_RHYTHM, MedicalEventSeverity.URGENT, 60],
  ])('%s is %s with a %is countdown', (type, severity, seconds) => {
    expect(SeverityPolicy.severityOf(type)).toBe(severity);
    expect(SeverityPolicy.opensIncident(severity)).toBe(true);
    expect(SeverityPolicy.responseSeconds(severity, windows)).toBe(seconds);
  });

  it('drowsiness is a warning that never opens an incident', () => {
    const severity = SeverityPolicy.severityOf(MedicalEventType.DROWSINESS);
    expect(severity).toBe(MedicalEventSeverity.WARNING);
    expect(SeverityPolicy.opensIncident(severity)).toBe(false);
    expect(SeverityPolicy.responseSeconds(severity, windows)).toBeNull();
  });

  it('orders severities', () => {
    expect(
      SeverityPolicy.isMoreSevere(
        MedicalEventSeverity.CRITICAL,
        MedicalEventSeverity.URGENT,
      ),
    ).toBe(true);
    expect(
      SeverityPolicy.isMoreSevere(
        MedicalEventSeverity.URGENT,
        MedicalEventSeverity.URGENT,
      ),
    ).toBe(false);
  });
});

describe('incident lifecycle', () => {
  it('"I\'m OK" cancels before escalation and resolves after', () => {
    expect(statusAfterAcknowledge(IncidentStatus.AWAITING_RESPONSE)).toBe(
      IncidentStatus.FALSE_ALARM,
    );
    expect(statusAfterAcknowledge(IncidentStatus.ESCALATED)).toBe(
      IncidentStatus.RESOLVED,
    );
    expect(statusAfterAcknowledge(IncidentStatus.RESOLVED)).toBeNull();
    expect(statusAfterAcknowledge(IncidentStatus.FALSE_ALARM)).toBeNull();
  });

  it('only awaiting and escalated incidents are active', () => {
    expect(isActiveIncident(IncidentStatus.AWAITING_RESPONSE)).toBe(true);
    expect(isActiveIncident(IncidentStatus.ESCALATED)).toBe(true);
    expect(isActiveIncident(IncidentStatus.RESOLVED)).toBe(false);
    expect(isActiveIncident(IncidentStatus.FALSE_ALARM)).toBe(false);
  });

  it('a new detection can shorten the countdown, never extend it', () => {
    const soon = new Date('2026-10-03T10:00:30Z');
    const later = new Date('2026-10-03T10:01:00Z');
    expect(tightenedDeadline(later, soon)).toBe(soon);
    expect(tightenedDeadline(soon, later)).toBe(soon);
    expect(tightenedDeadline(null, later)).toBe(later);
  });
});
