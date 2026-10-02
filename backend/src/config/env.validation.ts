import { plainToInstance, Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export const STORAGE_DRIVERS = ['local', 's3'] as const;
export type StorageDriver = (typeof STORAGE_DRIVERS)[number];

export const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

type TransformInput = { value: unknown };

const toInt = ({ value }: TransformInput): unknown =>
  typeof value === 'string' && /^-?\d+$/.test(value.trim())
    ? Number.parseInt(value, 10)
    : value;

const toBool = ({ value }: TransformInput): unknown => {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
};

const toList = ({ value }: TransformInput): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : value;

const HTTP_URL = {
  require_protocol: true,
  require_tld: false,
  protocols: ['http', 'https'],
};

/**
 * Single source of truth for environment variables. Validated once at startup:
 * the process refuses to boot with a missing or unsafe configuration.
 * Only files in src/config may read process.env.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsIn(LOG_LEVELS)
  LOG_LEVEL: LogLevel = 'info';

  @Transform(toList)
  @ArrayNotEmpty()
  @IsUrl(HTTP_URL, { each: true })
  CORS_ORIGINS!: string[];

  @IsUrl(HTTP_URL)
  FRONTEND_URL!: string;

  /** Number of reverse-proxy hops to trust for req.ip (0 = no proxy). */
  @Transform(toInt)
  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY = 0;

  @Transform(toBool)
  @IsBoolean()
  SWAGGER_ENABLED = false;

  @Matches(/^postgres(ql)?:\/\/.+/, {
    message: 'DATABASE_URL must be a postgresql:// connection string',
  })
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @Transform(toInt)
  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL_SECONDS = 900;

  @IsString()
  JWT_ISSUER = 'cabinguard-api';

  @IsString()
  JWT_AUDIENCE = 'cabinguard-web';

  @Transform(toInt)
  @IsInt()
  @Min(3600)
  REFRESH_SESSION_IDLE_TTL_SECONDS = 7 * 24 * 3600;

  @Transform(toInt)
  @IsInt()
  @Min(3600)
  REFRESH_SESSION_ABSOLUTE_TTL_SECONDS = 30 * 24 * 3600;

  /** HMAC key used to hash opaque tokens (refresh, invitation, reset) and sign CSRF tokens. */
  @IsString()
  @MinLength(32)
  TOKEN_HASH_SECRET!: string;

  /**
   * AES-256-GCM key for TOTP secrets at rest: 32 random bytes, base64.
   * Losing or changing it makes every enrolled authenticator unusable.
   */
  @Matches(/^[A-Za-z0-9+/_-]{43}=?$/, {
    message: 'MFA_ENCRYPTION_KEY must be 32 random bytes encoded in base64',
  })
  MFA_ENCRYPTION_KEY!: string;

  /**
   * Base of the shareable family invitation link (an https page that opens
   * the mobile app). The code is appended as a fragment. Default: FRONTEND_URL/join-family.
   */
  @IsOptional()
  @IsUrl(HTTP_URL)
  FAMILY_INVITE_URL?: string;

  /** Name shown in authenticator apps next to the account. */
  @IsString()
  MFA_ISSUER = 'CabinGuard';

  @Transform(toInt)
  @IsInt()
  @Min(3600)
  @Max(14 * 24 * 3600)
  INVITATION_TTL_SECONDS = 72 * 3600;

  @Transform(toInt)
  @IsInt()
  @Min(300)
  @Max(24 * 3600)
  PASSWORD_RESET_TTL_SECONDS = 30 * 60;

  @Transform(toBool)
  @IsBoolean()
  COOKIE_SECURE = true;

  @IsIn(['strict', 'lax'])
  COOKIE_SAME_SITE: 'strict' | 'lax' = 'strict';

  @IsString()
  MAIL_HOST!: string;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(65535)
  MAIL_PORT = 587;

  /** true = implicit TLS (port 465). false = STARTTLS upgrade (required, see mail.config). */
  @Transform(toBool)
  @IsBoolean()
  MAIL_SECURE = false;

  @IsOptional()
  @IsString()
  MAIL_USER?: string;

  @IsOptional()
  @IsString()
  MAIL_PASSWORD?: string;

  @IsString()
  MAIL_FROM!: string;

  /**
   * Where uploaded files (driver avatars) live: `local` = a folder on this
   * server (development only), `s3` = any S3-compatible bucket (production).
   */
  @IsIn(STORAGE_DRIVERS)
  STORAGE_DRIVER: StorageDriver = 'local';

  /** local driver: folder for uploads, relative to the working directory. */
  @IsString()
  STORAGE_LOCAL_DIR = 'uploads';

  /** Public base URL of this API, used to build signed local-file links. Defaults to http://localhost:PORT. */
  @IsOptional()
  @IsUrl(HTTP_URL)
  API_PUBLIC_URL?: string;

  @IsOptional()
  @IsString()
  S3_BUCKET?: string;

  @IsOptional()
  @IsString()
  S3_REGION?: string;

  /** Custom endpoint for S3-compatible services (MinIO, Cloudflare R2...). Empty = AWS. */
  @IsOptional()
  @IsUrl(HTTP_URL)
  S3_ENDPOINT?: string;

  @Transform(toBool)
  @IsBoolean()
  S3_FORCE_PATH_STYLE = false;

  /** Leave both empty to use the default AWS credential chain (IAM role, env, profile). */
  @IsOptional()
  @IsString()
  S3_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  S3_SECRET_ACCESS_KEY?: string;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  THROTTLE_DEFAULT_TTL_SECONDS = 60;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  THROTTLE_DEFAULT_LIMIT = 100;
}

function crossFieldErrors(env: EnvironmentVariables): string[] {
  const errors: string[] = [];
  if (env.JWT_ACCESS_SECRET === env.TOKEN_HASH_SECRET) {
    errors.push('JWT_ACCESS_SECRET and TOKEN_HASH_SECRET must be different');
  }
  if (Buffer.from(env.MFA_ENCRYPTION_KEY, 'base64').length !== 32) {
    errors.push('MFA_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
  if (
    env.MFA_ENCRYPTION_KEY === env.JWT_ACCESS_SECRET ||
    env.MFA_ENCRYPTION_KEY === env.TOKEN_HASH_SECRET
  ) {
    errors.push('MFA_ENCRYPTION_KEY must not reuse another secret');
  }
  if (
    env.REFRESH_SESSION_IDLE_TTL_SECONDS >
    env.REFRESH_SESSION_ABSOLUTE_TTL_SECONDS
  ) {
    errors.push(
      'REFRESH_SESSION_IDLE_TTL_SECONDS must be <= REFRESH_SESSION_ABSOLUTE_TTL_SECONDS',
    );
  }
  if (env.STORAGE_DRIVER === 's3' && (!env.S3_BUCKET || !env.S3_REGION)) {
    errors.push('S3_BUCKET and S3_REGION are required when STORAGE_DRIVER=s3');
  }
  if (Boolean(env.S3_ACCESS_KEY_ID) !== Boolean(env.S3_SECRET_ACCESS_KEY)) {
    errors.push(
      'S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set together (or both left empty)',
    );
  }
  if (env.NODE_ENV === NodeEnv.Production) {
    if (!env.COOKIE_SECURE)
      errors.push('COOKIE_SECURE must be true in production');
    if (env.SWAGGER_ENABLED)
      errors.push('SWAGGER_ENABLED must be false in production');
    if (env.CORS_ORIGINS.some((origin) => !origin.startsWith('https://'))) {
      errors.push('CORS_ORIGINS must only contain https origins in production');
    }
    if (!env.FRONTEND_URL.startsWith('https://')) {
      errors.push('FRONTEND_URL must be https in production');
    }
    if (env.STORAGE_DRIVER !== 's3') {
      errors.push('STORAGE_DRIVER must be s3 in production');
    }
  }
  return errors;
}

/** Used by ConfigModule.validate. Error messages name variables, never their values. */
export function validateEnv(
  raw: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, raw, {
    exposeDefaultValues: true,
  });
  const fieldErrors = validateSync(env, {
    skipMissingProperties: false,
    validationError: { target: false, value: false },
  }).map(
    (error) =>
      `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`,
  );
  const errors = [
    ...fieldErrors,
    ...(fieldErrors.length ? [] : crossFieldErrors(env)),
  ];
  if (errors.length) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}`,
    );
  }
  cachedEnv = env;
  return env;
}

let cachedEnv: EnvironmentVariables | undefined;

/**
 * Validated, typed configuration for the registerAs() factories.
 * ConfigModule.forRoot() calls validateEnv() with .env merged into process.env
 * and populates the cache; it does NOT copy non-scalar values (e.g. the parsed
 * CORS_ORIGINS array) back into process.env, so factories must read from here.
 */
export function readEnv(): EnvironmentVariables {
  return cachedEnv ?? validateEnv(process.env);
}
