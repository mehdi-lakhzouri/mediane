import { join } from 'node:path';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { Module } from '@nestjs/common';
import { mailConfig, type MailConfig } from '../../config';
import { MailSender } from './application/mail-sender';
import { NodemailerMailSender } from './infrastructure/nodemailer-mail.sender';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [mailConfig.KEY],
      useFactory: (mail: MailConfig) => ({
        transport: {
          host: mail.host,
          port: mail.port,
          secure: mail.secure,
          requireTLS: mail.requireTLS,
          auth: mail.auth,
          // A slow or unreachable SMTP host must not hold an admin request
          // open: fail fast and let the caller resend.
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
          // Nodemailer logging would print message bodies (temporary passwords, links).
          logger: false,
          debug: false,
        },
        template: {
          dir: join(__dirname, 'infrastructure', 'templates'),
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
        verifyTransporters: false,
      }),
    }),
  ],
  providers: [{ provide: MailSender, useClass: NodemailerMailSender }],
  exports: [MailSender],
})
export class MailModule {}
