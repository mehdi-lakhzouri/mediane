export interface InvitationMail {
  to: string;
  firstName: string;
  acceptUrl: string;
  /** Delivered once by email, never stored in clear, never logged. */
  temporaryPassword: string;
  expiresAt: Date;
}

export interface PasswordResetMail {
  to: string;
  firstName: string;
  resetUrl: string;
  expiresAt: Date;
}

/**
 * Sent to family members when a driver who shares incidents needs help, and
 * again when it is over. Deliberately minimal: who and when, never what
 * happened, readings or location (the app shows those to people entitled).
 */
export interface FamilyIncidentMail {
  to: string;
  firstName: string;
  driverName: string;
  occurredAt: Date;
}

/**
 * Port used by business services. Keeps transport and templating out of
 * users/invitations/auth, and lets tests use an in-memory fake.
 * Send AFTER the database transaction commits (a rolled-back invitation must
 * never be emailed). TODO: move to a transactional outbox if delivery must be guaranteed.
 */
export abstract class MailSender {
  abstract sendInvitation(mail: InvitationMail): Promise<void>;
  abstract sendInvitationResend(mail: InvitationMail): Promise<void>;
  abstract sendPasswordReset(mail: PasswordResetMail): Promise<void>;
  abstract sendFamilyIncidentAlert(mail: FamilyIncidentMail): Promise<void>;
  abstract sendFamilyAllClear(mail: FamilyIncidentMail): Promise<void>;
}
