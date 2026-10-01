import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  SWAGGER_ACCESS_COOKIE,
  SWAGGER_CSRF_HEADER,
} from '../common/http/swagger/api-security.decorators';
import {
  API_DEFAULT_VERSION,
  API_PREFIX,
  cookieConfig,
  type CookieConfig,
} from '../config';
import { CSRF_HEADER } from '../modules/security/presentation/csrf.constants';

/** Development only: main.ts never calls this when appConfig.swaggerEnabled is false. */
export function configureSwagger(app: INestApplication): void {
  const cookies = app.get<CookieConfig>(cookieConfig.KEY);
  const document = new DocumentBuilder()
    .setTitle('CabinGuard API')
    .setDescription(
      'Every response is wrapped as { data, meta, error }. ' +
        'Authentication uses HttpOnly cookies; state-changing requests need the X-CSRF-Token header ' +
        '(GET /auth/csrf).',
    )
    .setVersion(API_DEFAULT_VERSION)
    .addCookieAuth(
      cookies.names.accessToken,
      { type: 'apiKey', in: 'cookie' },
      SWAGGER_ACCESS_COOKIE,
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: CSRF_HEADER },
      SWAGGER_CSRF_HEADER,
    )
    .build();

  SwaggerModule.setup(
    `${API_PREFIX}/docs`,
    app,
    () => SwaggerModule.createDocument(app, document),
    { swaggerOptions: { withCredentials: true, persistAuthorization: false } },
  );
}
