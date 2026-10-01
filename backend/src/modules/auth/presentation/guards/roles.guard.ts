import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Role } from '../../../users/domain/role';
import { InsufficientPermissionsError } from '../../domain/auth.errors';
import {
  getAuthenticatedUser,
  IS_PUBLIC_KEY,
  ROLES_KEY,
} from '../decorators/auth.decorators';

/** Global. No-op on routes without @Roles(); otherwise the principal's role must match. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (!roles?.length) return true;

    const user = getAuthenticatedUser(
      context.switchToHttp().getRequest<Request>(),
    );
    if (!roles.includes(user.role)) throw new InsufficientPermissionsError();
    return true;
  }
}
