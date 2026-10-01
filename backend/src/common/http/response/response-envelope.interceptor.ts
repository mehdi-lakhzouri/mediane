import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { Request } from 'express';
import { map, Observable } from 'rxjs';
import { getRequestId } from '../request-context';
import { ApiEnvelope, ApiResult } from './api-response';

/** Wraps every successful HTTP response into `{ data, meta, error: null }`. */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((result): unknown => {
        if (result instanceof StreamableFile) return result;
        const payload: ApiResult<unknown> =
          result instanceof ApiResult
            ? (result as ApiResult<unknown>)
            : ApiResult.of(result ?? null);
        const envelope: ApiEnvelope<unknown> = {
          data: payload.data,
          meta: {
            requestId: getRequestId(req),
            timestamp: new Date().toISOString(),
            ...payload.meta,
          },
          error: null,
        };
        return envelope;
      }),
    );
  }
}
