import { join } from 'node:path';
import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Inject, Injectable } from '@nestjs/common';
import { mailConfig, type MailConfig } from '../../../config';
import {
  FamilyIncidentMail,
  InvitationMail,
  MailSender,
  PasswordResetMail,
} from '../application/mail-sender';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const EMAIL_BANNER_CID = 'mediane-email-banner@mediane';
const EMAIL_BANNER_PATH = join(
  __dirname,
  'templates',
  'assets',
  'mediane-email-banner.jpg',
);

/** Handlebars escapes every {{variable}}: never use triple-stash {{{ }}} with user data. */
@Injectable()
export class NodemailerMailSender implements MailSender {
  constructor(
    private readonly mailer: MailerService,
    @Inject(mailConfig.KEY) private readonly config: MailConfig,
  ) {}

  sendInvitation(mail: InvitationMail): Promise<void> {
    return this.send({
      to: mail.to,
      subject: 'Invitation à rejoindre Mediane',
      template: 'invitation',
      context: this.invitationContext(mail),
    });
  }

  sendInvitationResend(mail: InvitationMail): Promise<void> {
    return this.send({
      to: mail.to,
      subject: 'Nouvelle invitation Mediane',
      template: 'invitation-resend',
      context: this.invitationContext(mail),
    });
  }

  sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    return this.send({
      to: mail.to,
      subject: 'Réinitialisation de votre mot de passe Mediane',
      template: 'password-reset',
      context: {
        firstName: mail.firstName,
        resetUrl: mail.resetUrl,
        expiresAt: `${dateFormatter.format(mail.expiresAt)} (UTC)`,
      },
    });
  }

  sendFamilyIncidentAlert(mail: FamilyIncidentMail): Promise<void> {
    return this.send({
      to: mail.to,
      subject: `${mail.driverName} a peut-être besoin d’aide`,
      template: 'family-incident-alert',
      context: this.familyIncidentContext(mail),
      priority: 'high',
    });
  }

  sendFamilyAllClear(mail: FamilyIncidentMail): Promise<void> {
    return this.send({
      to: mail.to,
      subject: `${mail.driverName} va bien`,
      template: 'family-all-clear',
      context: this.familyIncidentContext(mail),
    });
  }

  private familyIncidentContext(
    mail: FamilyIncidentMail,
  ): Record<string, string> {
    return {
      firstName: mail.firstName,
      driverName: mail.driverName,
      occurredAt: `${dateFormatter.format(mail.occurredAt)} (UTC)`,
    };
  }

  private async send(options: ISendMailOptions): Promise<void> {
    await this.mailer.sendMail({
      from: this.config.from,
      ...options,
      attachments: [
        {
          filename: 'mediane-email-banner.jpg',
          path: EMAIL_BANNER_PATH,
          cid: EMAIL_BANNER_CID,
          contentDisposition: 'inline',
        },
        ...(options.attachments ?? []),
      ],
    });
  }

  private invitationContext(mail: InvitationMail): Record<string, string> {
    return {
      firstName: mail.firstName,
      acceptUrl: mail.acceptUrl,
      temporaryPassword: mail.temporaryPassword,
      expiresAt: `${dateFormatter.format(mail.expiresAt)} (UTC)`,
    };
  }
}
