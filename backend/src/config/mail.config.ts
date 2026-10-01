import { ConfigType, registerAs } from '@nestjs/config';
import { readEnv } from './env.validation';

export const mailConfig = registerAs('mail', () => {
  const env = readEnv();
  const usesAuth = Boolean(env.MAIL_USER && env.MAIL_PASSWORD);
  return {
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: env.MAIL_SECURE,
    /**
     * Without implicit TLS, refuse to send over a connection that was not
     * upgraded whenever credentials are on the line. Gmail on port 587 needs
     * STARTTLS, and a silent downgrade would put the app password in clear.
     * Only an unauthenticated local catcher (Mailpit) is allowed plaintext.
     */
    requireTLS: !env.MAIL_SECURE && usesAuth,
    auth:
      env.MAIL_USER && env.MAIL_PASSWORD
        ? { user: env.MAIL_USER, pass: env.MAIL_PASSWORD }
        : undefined,
    from: env.MAIL_FROM,
  };
});

export type MailConfig = ConfigType<typeof mailConfig>;
