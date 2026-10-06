import {
  applyDecorators,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../auth/presentation/decorators/auth.decorators';
import { SkipCsrf } from '../../security/presentation/skip-csrf.decorator';
import { DeviceAuthenticator } from '../application/device-authenticator';
import type { AuthenticatedDevice } from '../domain/device';
import { DeviceAuthenticationError } from '../domain/device.errors';
import { DeviceHeaders } from '../domain/device-signature';

type DeviceRequest = Request & {
  rawBody?: Buffer;
  device?: AuthenticatedDevice;
};

const EMPTY_BODY = Buffer.alloc(0);

/**
 * Authenticates in-cabin units by request signature. Device routes carry no
 * user session and no cookies, so the user guards and CSRF do not apply.
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly authenticator: DeviceAuthenticator) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<DeviceRequest>();
    req.device = await this.authenticator.authenticate({
      method: req.method,
      path: req.originalUrl,
      header: (name) => req.get(name),
      rawBody: req.rawBody ?? EMPTY_BODY,
    });
    return true;
  }
}

/** Marks a controller or route as called by signed in-cabin units only. */
export const DeviceAuth = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    Public(),
    SkipCsrf(),
    UseGuards(DeviceAuthGuard),
    ...Object.values(DeviceHeaders).map((name) =>
      ApiHeader({ name, required: true }),
    ),
  );

/** The unit behind the verified request. */
export const CurrentDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedDevice => {
    const device = ctx.switchToHttp().getRequest<DeviceRequest>().device;
    if (!device) throw new DeviceAuthenticationError();
    return device;
  },
);
