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
 * Port used by business services. Keeps transport and templating out of
 * users/invitations/auth, and lets tests use an in-memory fake.
 * Send AFTER the database transaction commits (a rolled-back invitation must
 * never be emailed). TODO: move to a transactional outbox if delivery must be guaranteed.
 */
export abstract class MailSender {
  abstract sendInvitation(mail: InvitationMail): Promise<void>;
  abstract sendInvitationResend(mail: InvitationMail): Promise<void>;
  abstract sendPasswordReset(mail: PasswordResetMail): Promise<void>;
}
