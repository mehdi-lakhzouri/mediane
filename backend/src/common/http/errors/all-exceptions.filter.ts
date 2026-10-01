import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from '../../errors';
import { getRequestId } from '../request-context';
import type { ApiEnvelope, ApiErrorBody } from '../response/api-response';
import {
  genericErrorForStatus,
  HTTP_STATUS_BY_ERROR_KIND,
  INTERNAL_ERROR,
} from './error-http-mapping';

/** Errors produced by Express middlewares (body-parser...) that are safe to expose. */
interface ExposableHttpError {
  status: number;
  expose: true;
}

function isExposableHttpError(error: unknown): error is ExposableHttpError {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Record<string, unknown>;
  return (
    candidate.expose === true &&
    typeof candidate.status === 'number' &&
    candidate.status >= 400 &&
    candidate.status < 500
  );
}

/**
 * Single place where errors become HTTP responses, always as
 * `{ data: null, meta, error: { code, message, details? } }`.
 *
 * - AppError: mapped from its kind; code/message are designed to be public.
 * - HttpException / framework errors: generic message per status (no internals).
 * - Anything else (Prisma, bugs...): 500 with a generic message; full error is logged server-side only.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;

    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = getRequestId(req);
    const { status, error } = this.toErrorResponse(exception);

    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId },
        'Request failed with an unhandled error',
      );
    }

    if (res.headersSent) return;

    const envelope: ApiEnvelope<null> = {
      data: null,
      meta: { requestId, timestamp: new Date().toISOString() },
      error,
    };
    res.status(status).json(envelope);
  }

  private toErrorResponse(exception: unknown): {
    status: number;
    error: ApiErrorBody;
  } {
    if (exception instanceof AppError) {
      return {
        status: HTTP_STATUS_BY_ERROR_KIND[exception.kind],
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.details?.length ? { details: exception.details } : {}),
        },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return { status, error: genericErrorForStatus(status) };
    }
    if (isExposableHttpError(exception)) {
      return {
        status: exception.status,
        error: genericErrorForStatus(exception.status),
      };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, error: INTERNAL_ERROR };
  }
}
