import { ConfigType, registerAs } from '@nestjs/config';
import { NodeEnv, readEnv } from './env.validation';

/**
 * SMS to emergency contacts. `textbee` is null when no API key is set, and
 * always in tests so a test run never texts a real phone.
 */
export const smsConfig = registerAs('sms', () => {
  const env = readEnv();
  return {
    textbee:
      env.TEXTBEE_API_KEY && env.NODE_ENV !== NodeEnv.Test
        ? {
            apiKey: env.TEXTBEE_API_KEY,
            deviceId: env.TEXTBEE_DEVICE_ID ?? null,
            apiUrl: env.TEXTBEE_API_URL,
          }
        : null,
  };
});

export type SmsConfig = ConfigType<typeof smsConfig>;
export type TextbeeConfig = NonNullable<SmsConfig['textbee']>;
