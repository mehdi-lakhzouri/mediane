import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiSecurity } from '@nestjs/swagger';

export const SWAGGER_ACCESS_COOKIE = 'access-cookie';
export const SWAGGER_CSRF_HEADER = 'csrf-header';
export const SWAGGER_MOBILE_BEARER = 'mobile-bearer';

/** Documents that the route needs the access-token cookie. */
export const ApiSessionAuth = (): MethodDecorator & ClassDecorator =>
  applyDecorators(ApiCookieAuth(SWAGGER_ACCESS_COOKIE));

/** Documents that the route needs the X-CSRF-Token header (state-changing routes). */
export const ApiCsrf = (): MethodDecorator & ClassDecorator =>
  applyDecorators(ApiSecurity(SWAGGER_CSRF_HEADER));

/** Documents that the route needs the mobile access token (`Authorization: Bearer`). */
export const ApiMobileAuth = (): MethodDecorator & ClassDecorator =>
  applyDecorators(ApiBearerAuth(SWAGGER_MOBILE_BEARER));
