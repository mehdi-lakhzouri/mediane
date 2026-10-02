import { ConfigType, registerAs } from '@nestjs/config';
import { isAbsolute, resolve } from 'node:path';
import { API_BASE_PATH } from './api.constants';
import { readEnv } from './env.validation';

export const storageConfig = registerAs('storage', () => {
  const env = readEnv();
  const apiPublicUrl = (
    env.API_PUBLIC_URL ?? `http://localhost:${env.PORT}`
  ).replace(/\/+$/, '');
  return {
    driver: env.STORAGE_DRIVER,
    local: {
      directory: isAbsolute(env.STORAGE_LOCAL_DIR)
        ? env.STORAGE_LOCAL_DIR
        : resolve(process.cwd(), env.STORAGE_LOCAL_DIR),
      /** Absolute base of the signed download route (see LocalFilesController). */
      publicBaseUrl: `${apiPublicUrl}${API_BASE_PATH}/files`,
    },
    s3: {
      bucket: env.S3_BUCKET ?? '',
      region: env.S3_REGION ?? '',
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.S3_ACCESS_KEY_ID,
              secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    },
  };
});

export type StorageConfig = ConfigType<typeof storageConfig>;
