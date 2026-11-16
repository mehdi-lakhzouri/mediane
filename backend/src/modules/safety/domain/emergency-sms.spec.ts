import { composeEmergencySms } from './emergency-sms';
import { type EmergencyMessage, NotificationKind } from './notification';

const alert: EmergencyMessage = {
  kind: NotificationKind.ALERT,
  incidentId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
  driver: {
    firstName: 'Amira',
    lastName: 'Ben Ali',
    phoneNumber: '+21655000001',
  },
  alertReason: 'NO_RESPONSE',
  location: { latitude: 36.8065, longitude: 10.1815, accuracyM: 12 },
  // 10:00 UTC is 11:00 in Tunisia.
  occurredAt: new Date('2026-10-03T10:00:30Z'),
};

describe('composeEmergencySms', () => {
  it('reads as a short structured message: who, what, when, what to do, where', () => {
    expect(composeEmergencySms(alert)).toBe(
      [
        'Mediane - Alerte pour Amira Ben Ali',
        '',
        "Amira n'a pas répondu après une alerte de sécurité dans son véhicule (le 03/10/2026 à 11:00).",
        '',
        'Que faire : appelez Amira au +21655000001.',
        'Dernière position connue : https://maps.google.com/?q=36.80650,10.18150',
        '',
        "Vous recevez ce message car Amira vous a désigné(e) comme contact d'urgence.",
      ].join('\n'),
    );
  });

  it('stays non-technical: no reference, UTC, model, confidence or diagnosis', () => {
    const sms = composeEmergencySms(alert);
    expect(sms).not.toContain(alert.incidentId);
    expect(sms).not.toMatch(/\bUTC\b|Réf|\bIA\b|\bAI\b|%/);
    expect(sms).not.toMatch(/modèle|model|confiance|confidence|score/i);
    expect(sms).not.toMatch(
      /stroke|avc|seizure|crise|épilep|cardiac|cardiaque/i,
    );
  });

  it('never refers the contact to an emergency service', () => {
    expect(composeEmergencySms(alert)).not.toMatch(
      /samu|190|198|secours|urgences|pompiers|police/i,
    );
  });

  it('distinguishes an SOS from an unanswered alert', () => {
    const sms = composeEmergencySms({ ...alert, alertReason: 'SOS' });
    expect(sms).toContain("Amira a demandé de l'aide depuis son véhicule");
    expect(sms).not.toContain("n'a pas répondu");
  });

  it('uses a neutral sentence when the reason is unknown', () => {
    expect(composeEmergencySms({ ...alert, alertReason: undefined })).toContain(
      'Une alerte de sécurité concernant Amira a été déclenchée',
    );
  });

  it('does not invent or pass through a doubtful callback number', () => {
    for (const phoneNumber of [
      null,
      undefined,
      'invalid',
      '+21655000001\nOther instruction',
    ]) {
      const sms = composeEmergencySms({
        ...alert,
        driver: { ...alert.driver, phoneNumber },
      });
      expect(sms).toContain(
        'Que faire : essayez de joindre Amira dès maintenant.',
      );
      expect(sms).not.toContain('Other instruction');
    }
  });

  it('says so when no usable position was reported', () => {
    for (const location of [
      null,
      { latitude: Number.NaN, longitude: 10, accuracyM: null },
      { latitude: 91, longitude: 10, accuracyM: null },
      { latitude: 36, longitude: -181, accuracyM: null },
    ]) {
      const sms = composeEmergencySms({ ...alert, location });
      expect(sms).toContain('Position non disponible.');
      expect(sms).not.toContain('maps.google.com');
    }
    expect(
      composeEmergencySms({
        ...alert,
        location: { latitude: 0, longitude: 0, accuracyM: null },
      }),
    ).toContain('?q=0.00000,0.00000');
  });

  it('confirms the driver is fine only when the driver answered', () => {
    for (const resolvedVia of ['APP', 'DEVICE'] as const) {
      expect(
        composeEmergencySms({
          ...alert,
          kind: NotificationKind.ALL_CLEAR,
          resolvedVia,
        }),
      ).toBe(
        [
          "Mediane - Fin d'alerte pour Amira Ben Ali",
          '',
          "Amira a confirmé aller bien le 03/10/2026 à 11:00. L'alerte est terminée.",
        ].join('\n'),
      );
    }
  });

  it('asks the contact to check in after an automatic or unknown closure', () => {
    const automatic = composeEmergencySms({
      ...alert,
      kind: NotificationKind.ALL_CLEAR,
      resolvedVia: 'SYSTEM',
    });
    expect(automatic).toContain('clôturée automatiquement');
    expect(automatic).toContain('sans confirmation de Amira');
    for (const resolvedVia of ['SYSTEM', null] as const) {
      const sms = composeEmergencySms({
        ...alert,
        kind: NotificationKind.ALL_CLEAR,
        resolvedVia,
      });
      expect(sms).toContain('prendre des nouvelles de Amira');
      expect(sms).not.toContain('a confirmé');
      expect(sms).not.toContain('maps.google.com');
    }
  });

  it('keeps names on one line and bounds their length', () => {
    const sms = composeEmergencySms({
      ...alert,
      driver: { firstName: '  Amira\n', lastName: ' Ben   Ali ' },
    });
    expect(sms.split('\n')[0]).toBe('Mediane - Alerte pour Amira Ben Ali');
    const long = composeEmergencySms({
      ...alert,
      driver: { firstName: 'A'.repeat(100), lastName: 'B'.repeat(100) },
    });
    expect(long.split('\n')[0]).toBe(`Mediane - Alerte pour ${'A'.repeat(80)}`);
  });
});
