/**
 * Minimal client for the CabinGuard API.
 *
 * - Every response is `{ data, meta, error }`; this module unwraps it.
 * - Auth lives in HttpOnly cookies set by the API: nothing is ever stored in
 *   localStorage and JS never sees the access/refresh tokens.
 * - State-changing requests carry the CSRF token in `X-CSRF-Token`. It is kept
 *   in memory only (the API may run on another origin, so its cookie is not
 *   readable from here) and is refreshed from GET /auth/csrf when missing.
 * - A 401 triggers one silent POST /auth/refresh, then one retry. Callers only
 *   see the 401 if that refresh also fails.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

const CSRF_HEADER = "X-CSRF-Token";

/** Endpoints that must never trigger the refresh-and-retry dance. */
// A 401 from these means "wrong credentials / expired step", not an expired
// access token: refreshing the session would be pointless.
const NO_REFRESH_PATHS = new Set([
  "/auth/login",
  "/auth/mfa/challenge",
  "/auth/refresh",
  "/auth/logout",
  "/auth/csrf",
]);

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

interface ApiErrorBody {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  pagination?: PaginationMeta;
}

export interface ApiEnvelope<T> {
  data: T | null;
  meta: ApiMeta;
  error: ApiErrorBody | null;
}

// Fields are declared and assigned rather than using TypeScript parameter
// properties, so this module also runs under Node's type-stripping loader.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details: ApiErrorDetail[] = [],
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface Attempt {
  /** Allow one refresh-and-retry on 401. */
  refresh: boolean;
  /** Allow one CSRF re-fetch and retry. */
  csrf: boolean;
}

let csrfToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
const sessionLostHandlers = new Set<() => void>();

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

/**
 * Called once when the session is gone for good: the access token expired and
 * the refresh token could not renew it. Lets the shell send the user to sign in
 * from anywhere, without every caller handling 401 itself.
 */
export function onSessionLost(handler: () => void): () => void {
  sessionLostHandlers.add(handler);
  return () => sessionLostHandlers.delete(handler);
}

export async function refreshCsrfToken(): Promise<string> {
  const { csrfToken: token } = await send<{ csrfToken: string }>(
    "GET",
    "/auth/csrf",
  );
  csrfToken = token;
  return token;
}

/** Shared across concurrent 401s so a burst of requests triggers one refresh. */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= attemptRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function attemptRefresh(): Promise<boolean> {
  try {
    const data = await send<{ csrfToken?: string }>(
      "POST",
      "/auth/refresh",
      undefined,
      { refresh: false, csrf: true },
    );
    // A new session means a rotated CSRF token.
    if (data?.csrfToken) csrfToken = data.csrfToken;
    return true;
  } catch {
    csrfToken = null;
    return false;
  }
}

async function parseEnvelope<T>(
  response: Response,
): Promise<ApiEnvelope<T> | null> {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return null;
  }
}

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  attempt: Attempt = { refresh: true, csrf: true },
): Promise<ApiEnvelope<T>> {
  const isUnsafe = method !== "GET";
  if (isUnsafe && !csrfToken) await refreshCsrfToken();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (isUnsafe && csrfToken) headers[CSRF_HEADER] = csrfToken;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Unable to reach the server. Check your connection and try again.",
    );
  }

  const envelope = await parseEnvelope<T>(response);
  const error = envelope?.error;

  if (!response.ok || error) {
    // The access token expired: renew once, then replay the original request.
    if (
      response.status === 401 &&
      attempt.refresh &&
      !NO_REFRESH_PATHS.has(path)
    ) {
      if (await refreshSession()) {
        return request<T>(method, path, body, { ...attempt, refresh: false });
      }
      sessionLostHandlers.forEach((handler) => handler());
    }

    // The CSRF cookie can expire with the browser session: fetch a new one once.
    if (error?.code === "CSRF_VALIDATION_FAILED" && attempt.csrf) {
      csrfToken = null;
      return request<T>(method, path, body, { ...attempt, csrf: false });
    }

    throw new ApiError(
      response.status,
      error?.code ?? "HTTP_ERROR",
      error?.message ?? "Unexpected response from the server.",
      error?.details ?? [],
      envelope?.meta.requestId,
    );
  }

  return (envelope ?? {
    data: null,
    meta: { requestId: "unknown", timestamp: new Date().toISOString() },
    error: null,
  }) as ApiEnvelope<T>;
}

async function send<T>(
  method: Method,
  path: string,
  body?: unknown,
  attempt: Attempt = { refresh: true, csrf: true },
): Promise<T> {
  const envelope = await request<T>(method, path, body, attempt);
  return envelope.data as T;
}

export const api = {
  get: <T>(path: string) => send<T>("GET", path),
  /** For endpoints whose pagination lives in `meta`. */
  getWithMeta: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => send<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => send<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => send<T>("PATCH", path, body),
  delete: <T>(path: string) => send<T>("DELETE", path),
};
