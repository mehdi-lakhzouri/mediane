import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AccountState } from '../../../users/domain/account-state';
import { AccountStateRestrictedError } from '../../domain/auth.errors';
import {
  ALLOWED_ACCOUNT_STATES_KEY,
  getAuthenticatedUser,
  IS_PUBLIC_KEY,
} from '../decorators/auth.decorators';

const DEFAULT_ALLOWED_STATES: readonly AccountState[] = [AccountState.ACTIVE];

/**
 * Global. Enforces the onboarding funnel server-side: until the password is
 * changed and (for drivers) the profile completed, only explicitly allowed
 * endpoints are reachable, whatever the frontend does.
 */
@Injectable()
export class AccountStateGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    const allowed =
      this.reflector.getAllAndOverride<AccountState[] | undefined>(
        ALLOWED_ACCOUNT_STATES_KEY,
        targets,
      ) ?? DEFAULT_ALLOWED_STATES;

    const user = getAuthenticatedUser(
      context.switchToHttp().getRequest<Request>(),
    );
    if (!allowed.includes(user.accountState)) {
      throw new AccountStateRestrictedError(user.accountState);
    }
    return true;
  }
}
