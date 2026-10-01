import { join } from 'node:path';
import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Inject, Injectable } from '@nestjs/common';
import { mailConfig, type MailConfig } from '../../../config';
import {
  InvitationMail,
  MailSender,
  PasswordResetMail,
} from '../application/mail-sender';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const EMAIL_BANNER_CID = 'cabinguard-email-banner@cabinguard';
const EMAIL_BANNER_PATH = join(
  __dirname,
  'templates',
  'assets',
  'cabinguard-email-banner.jpg',
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
      subject: 'Invitation à rejoindre CabinGuard',
      template: 'invitation',
      context: this.invitationContext(mail),
    });
  }

  sendInvitationResend(mail: InvitationMail): Promise<void> {
    return this.send({
      to: mail.to,
      subject: 'Nouvelle invitation CabinGuard',
      template: 'invitation-resend',
      context: this.invitationContext(mail),
    });
  }

  sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    return this.send({
      to: mail.to,
      subject: 'Réinitialisation de votre mot de passe CabinGuard',
      template: 'password-reset',
      context: {
        firstName: mail.firstName,
        resetUrl: mail.resetUrl,
        expiresAt: `${dateFormatter.format(mail.expiresAt)} (UTC)`,
      },
    });
  }

  private async send(options: ISendMailOptions): Promise<void> {
    await this.mailer.sendMail({
      from: this.config.from,
      ...options,
      attachments: [
        {
          filename: 'cabinguard-email-banner.jpg',
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
