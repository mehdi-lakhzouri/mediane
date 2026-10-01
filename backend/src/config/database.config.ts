import { ConfigType, registerAs } from '@nestjs/config';
import { readEnv } from './env.validation';

export const databaseConfig = registerAs('database', () => ({
  url: readEnv().DATABASE_URL,
}));

export type DatabaseConfig = ConfigType<typeof databaseConfig>;
