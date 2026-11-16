import { type EmergencyMessage, NotificationKind } from './notification';

/** Contacts read the time where the service runs (Tunisia), not in UTC. */
const TIME_ZONE = 'Africa/Tunis';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeZone: TIME_ZONE,
});
const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

const E164 = /^\+[1-9]\d{1,14}$/;

/**
 * The SMS an emergency contact receives: plain French for someone who has
 * never heard of Mediane. Who, what happened in everyday words, when, what to
 * do, and where. Nothing technical: no reference, no model, no confidence
 * score, no medical detail. It informs the contact; it never contacts or
 * names an emergency service on their behalf.
 */
export function composeEmergencySms(message: EmergencyMessage): string {
  const firstName = clean(message.driver.firstName, 40) || 'Le conducteur';
  const fullName =
    clean(`${message.driver.firstName} ${message.driver.lastName}`, 80) ||
    'un conducteur';
  const when = `le ${dateFormatter.format(message.occurredAt)} à ${timeFormatter.format(message.occurredAt)}`;

  if (message.kind === NotificationKind.ALL_CLEAR) {
    return [
      `Mediane - Fin d'alerte pour ${fullName}`,
      '',
      closureSentence(message.resolvedVia, firstName, when),
    ].join('\n');
  }

  const lines = [
    `Mediane - Alerte pour ${fullName}`,
    '',
    `${alertSentence(message.alertReason, firstName)} (${when}).`,
    '',
  ];
  const phone = message.driver.phoneNumber;
  lines.push(
    phone && E164.test(phone)
      ? `Que faire : appelez ${firstName} au ${phone}.`
      : `Que faire : essayez de joindre ${firstName} dès maintenant.`,
  );
  const position = mapLink(message.location);
  lines.push(
    position
      ? `Dernière position connue : ${position}`
      : 'Position non disponible.',
  );
  lines.push(
    '',
    `Vous recevez ce message car ${firstName} vous a désigné(e) comme contact d'urgence.`,
  );
  return lines.join('\n');
}

function alertSentence(
  reason: EmergencyMessage['alertReason'],
  firstName: string,
): string {
  switch (reason) {
    case 'SOS':
      return `${firstName} a demandé de l'aide depuis son véhicule`;
    case 'NO_RESPONSE':
      return `${firstName} n'a pas répondu après une alerte de sécurité dans son véhicule`;
    default:
      return `Une alerte de sécurité concernant ${firstName} a été déclenchée`;
  }
}

/** Only a recorded answer from the driver counts as "is fine". */
function closureSentence(
  via: EmergencyMessage['resolvedVia'],
  firstName: string,
  when: string,
): string {
  if (via === 'APP' || via === 'DEVICE') {
    return `${firstName} a confirmé aller bien ${when}. L'alerte est terminée.`;
  }
  const checkIn = `Nous vous conseillons de prendre des nouvelles de ${firstName}.`;
  return via === 'SYSTEM'
    ? `L'alerte a été clôturée automatiquement ${when}, sans confirmation de ${firstName}. ${checkIn}`
    : `L'alerte a été clôturée ${when}. ${checkIn}`;
}

function mapLink(location: EmergencyMessage['location']): string | null {
  if (
    !location ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    Math.abs(location.latitude) > 90 ||
    Math.abs(location.longitude) > 180
  ) {
    return null;
  }
  return `https://maps.google.com/?q=${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;
}

/** One line, bounded: names come from user input. */
function clean(value: string, max: number): string {
  return Array.from(value.replace(/\s+/g, ' ').trim()).slice(0, max).join('');
}
