import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PinoLogger } from 'nestjs-pino';
import { AppError } from '../../../../common/errors';
import { isAuthenticatedUser } from '../../domain/authenticated-user';
import { AuthenticationRequiredError } from '../../domain/auth.errors';
import { JWT_ACCESS_STRATEGY } from '../../infrastructure/jwt-access.strategy';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';

/** Global: every route requires a valid access cookie unless marked @Public(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard(JWT_ACCESS_STRATEGY) {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: unknown, user: unknown): TUser {
    if (err instanceof AppError) throw err;
    if (err || !isAuthenticatedUser(user)) {
      throw new AuthenticationRequiredError();
    }
    // Adds userId to every subsequent log line of this request (incl. the access log).
    this.logger.assign({ userId: user.userId });
    return user as TUser;
  }
}
