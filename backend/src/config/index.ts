import { appConfig } from './app.config';
import { authConfig } from './auth.config';
import { cookieConfig } from './cookie.config';
import { databaseConfig } from './database.config';
import { mailConfig } from './mail.config';
import { mfaConfig } from './mfa.config';
import { storageConfig } from './storage.config';
import { throttleConfig } from './throttle.config';

export * from './api.constants';
export * from './app.config';
export * from './auth.config';
export * from './cookie.config';
export * from './database.config';
export * from './env.validation';
export * from './mail.config';
export * from './mfa.config';
export * from './storage.config';
export * from './throttle.config';

export const allConfigs = [
  appConfig,
  authConfig,
  cookieConfig,
  databaseConfig,
  mailConfig,
  mfaConfig,
  storageConfig,
  throttleConfig,
];
