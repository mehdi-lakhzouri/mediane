import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ClientContext } from '../../application/client-context';
import { getClientContext } from '../request-context';

/** Injects request id, client IP and user agent (for audit logs and sessions). */
export const ClientInfo = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClientContext =>
    getClientContext(ctx.switchToHttp().getRequest<Request>()),
);
