import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet, { type HelmetOptions } from 'helmet';
import { Logger } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from '../common/http/request-context';
import {
  API_DEFAULT_VERSION,
  API_PREFIX,
  appConfig,
  type AppConfig,
} from '../config';
import { CSRF_HEADER } from '../modules/security/presentation/csrf.constants';

function helmetOptions(config: AppConfig): HelmetOptions {
  return {
    // JSON API: nothing to render. Swagger UI (dev only) needs self-hosted assets.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: config.swaggerEnabled
        ? {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            frameAncestors: ["'none'"],
          }
        : {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'none'"],
            formAction: ["'none'"],
          },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: config.isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true }
      : false,
  };
}

/**
 * HTTP-level setup shared by main.ts and e2e tests. Global pipe, guards,
 * interceptor and filter are registered in AppModule (so tests get them too).
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<AppConfig>(appConfig.KEY);

  app.useLogger(app.get(Logger));

  // Correct req.ip behind reverse proxies (rate limiting, audit). 0 = no proxy.
  app.set('trust proxy', config.trustProxy);
  app.use(helmet(helmetOptions(config)));
  app.use(cookieParser());
  app.useBodyParser('json', { limit: config.bodyLimit });
  app.useBodyParser('urlencoded', { extended: false, limit: config.bodyLimit });

  app.enableCors({
    origin: config.corsOrigins, // explicit allow-list, never '*' with credentials
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', CSRF_HEADER, REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER],
    maxAge: 600,
  });

  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_DEFAULT_VERSION,
  });

  app.enableShutdownHooks();
}
