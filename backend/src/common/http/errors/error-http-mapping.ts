import { HttpStatus } from '@nestjs/common';
import { ErrorKind } from '../../errors';

export const HTTP_STATUS_BY_ERROR_KIND: Record<ErrorKind, HttpStatus> = {
  [ErrorKind.VALIDATION]: HttpStatus.BAD_REQUEST,
  [ErrorKind.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
  [ErrorKind.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorKind.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorKind.CONFLICT]: HttpStatus.CONFLICT,
  [ErrorKind.BUSINESS_RULE]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorKind.NOT_IMPLEMENTED]: HttpStatus.NOT_IMPLEMENTED,
};

/** Codes/messages for errors raised by the framework itself (routing, body parser, throttler...). */
const GENERIC_ERRORS: Partial<
  Record<number, { code: string; message: string }>
> = {
  400: { code: 'BAD_REQUEST', message: 'The request is invalid.' },
  401: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
  403: {
    code: 'FORBIDDEN',
    message: 'You are not allowed to perform this action.',
  },
  404: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
  405: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
  409: {
    code: 'CONFLICT',
    message: 'The request conflicts with the current state.',
  },
  413: {
    code: 'PAYLOAD_TOO_LARGE',
    message: 'The request payload is too large.',
  },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported media type.' },
  429: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please retry later.',
  },
  501: {
    code: 'NOT_IMPLEMENTED',
    message: 'This feature is not available yet.',
  },
  503: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'The service is temporarily unavailable.',
  },
};

export const INTERNAL_ERROR = {
  code: 'INTERNAL_ERROR',
  message: 'An unexpected error occurred.',
} as const;

export function genericErrorForStatus(status: number): {
  code: string;
  message: string;
} {
  return (
    GENERIC_ERRORS[status] ??
    (status >= 500
      ? INTERNAL_ERROR
      : {
          code: 'REQUEST_ERROR',
          message: 'The request could not be processed.',
        })
  );
}
