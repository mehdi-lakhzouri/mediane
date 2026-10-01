import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiSecurity } from '@nestjs/swagger';

export const SWAGGER_ACCESS_COOKIE = 'access-cookie';
export const SWAGGER_CSRF_HEADER = 'csrf-header';

/** Documents that the route needs the access-token cookie. */
export const ApiSessionAuth = (): MethodDecorator & ClassDecorator =>
  applyDecorators(ApiCookieAuth(SWAGGER_ACCESS_COOKIE));

/** Documents that the route needs the X-CSRF-Token header (state-changing routes). */
export const ApiCsrf = (): MethodDecorator & ClassDecorator =>
  applyDecorators(ApiSecurity(SWAGGER_CSRF_HEADER));
