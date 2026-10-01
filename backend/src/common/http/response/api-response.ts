import type { ErrorDetail } from '../../errors';

/**
 * Every API response (success or failure) has the same shape:
 *
 *   { "data": T | null, "meta": { requestId, timestamp, ... }, "error": ApiErrorBody | null }
 *
 * Exactly one of `data` / `error` is meaningful: on success `error` is null,
 * on failure `data` is null.
 */
export interface ApiEnvelope<T> {
  data: T | null;
  meta: ApiMeta;
  error: ApiErrorBody | null;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: readonly ErrorDetail[];
}

type ExtraMeta = Omit<ApiMeta, 'requestId' | 'timestamp'>;

/**
 * Optional controller return type when a handler needs to contribute to `meta`
 * (e.g. pagination). Handlers returning a plain value get `meta` defaults.
 */
export class ApiResult<T> {
  private constructor(
    readonly data: T,
    readonly meta: ExtraMeta,
  ) {}

  static of<T>(data: T, meta: ExtraMeta = {}): ApiResult<T> {
    return new ApiResult(data, meta);
  }

  static paginated<T>(
    items: T[],
    page: { page: number; pageSize: number; totalItems: number },
  ): ApiResult<T[]> {
    return new ApiResult(items, {
      pagination: {
        ...page,
        totalPages: Math.ceil(page.totalItems / page.pageSize),
      },
    });
  }
}
