import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { ClientContext } from '../application/client-context';

export const REQUEST_ID_HEADER = 'X-Request-Id';

// Accept client-supplied correlation IDs only if they are harmless (prevents log injection).
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function resolveIncomingRequestId(header: unknown): string {
  return typeof header === 'string' && REQUEST_ID_PATTERN.test(header)
    ? header
    : randomUUID();
}

/**
 * The id assigned by pino-http (see LoggingModule), shared by logs and `meta.requestId`.
 * Errors raised by Express middlewares registered before pino-http (body parser)
 * have no id yet: one is assigned here and echoed in the X-Request-Id header.
 */
export function getRequestId(req: Request): string {
  const id: unknown = req.id;
  if (typeof id === 'string') return id;
  const generated = resolveIncomingRequestId(req.headers['x-request-id']);
  req.id = generated;
  if (!req.res?.headersSent) req.res?.setHeader(REQUEST_ID_HEADER, generated);
  return generated;
}

export function getClientContext(req: Request): ClientContext {
  const userAgent = req.get('user-agent');
  return {
    requestId: getRequestId(req),
    ipAddress: req.ip ?? null,
    userAgent: userAgent ? userAgent.slice(0, 512) : null,
  };
}

export function readCookie(req: Request, name: string): string | undefined {
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) return undefined;
  const value: unknown = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
