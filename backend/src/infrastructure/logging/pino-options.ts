import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request } from 'express';
import type { Params } from 'nestjs-pino';
import type { AppConfig } from '../../config';
import { SENSITIVE_KEYS } from '../../common/security/sensitive-data';
import {
  REQUEST_ID_HEADER,
  resolveIncomingRequestId,
} from '../../common/http/request-context';

/**
 * Defense in depth: the serializers below already drop headers and bodies,
 * redaction covers anything logged explicitly by application code.
 */
function redactPaths(): string[] {
  const fieldPaths = SENSITIVE_KEYS.flatMap((key) => [
    key,
    `*.${key}`,
    `*.*.${key}`,
  ]);
  return [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-csrf-token"]',
    'res.headers["set-cookie"]',
    ...fieldPaths,
  ];
}

/** Query strings may carry tokens: only the path is logged. */
function pathOnly(url: string | undefined): string | undefined {
  return url?.split('?')[0];
}

interface SerializedReq {
  id?: unknown;
  method?: string;
  url?: string;
}

interface SerializedRes {
  statusCode?: number;
}

export function buildPinoParams(app: AppConfig): Params {
  return {
    // userId is attached after authentication via PinoLogger.assign (see JwtAuthGuard).
    assignResponse: true,
    pinoHttp: {
      level: app.logLevel,
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const id = resolveIncomingRequestId(req.headers['x-request-id']);
        res.setHeader(REQUEST_ID_HEADER, id);
        return id;
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customProps: (req) => ({ ip: (req as Request).ip }),
      serializers: {
        req: (req: SerializedReq) => ({
          id: req.id,
          method: req.method,
          url: pathOnly(req.url),
        }),
        res: (res: SerializedRes) => ({ statusCode: res.statusCode }),
      },
      redact: { paths: redactPaths(), censor: '[REDACTED]' },
      transport: app.isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
          },
    },
  };
}
