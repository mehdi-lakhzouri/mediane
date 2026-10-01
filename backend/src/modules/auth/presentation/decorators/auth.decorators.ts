import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AccountState,
  AUTHENTICABLE_ACCOUNT_STATES,
} from '../../../users/domain/account-state';
import { Role } from '../../../users/domain/role';
import {
  AuthenticatedUser,
  isAuthenticatedUser,
} from '../../domain/authenticated-user';
import { AuthenticationRequiredError } from '../../domain/auth.errors';

export const IS_PUBLIC_KEY = 'auth:is-public';
export const ROLES_KEY = 'auth:roles';
export const ALLOWED_ACCOUNT_STATES_KEY = 'auth:allowed-account-states';

/**
 * Routes are authenticated BY DEFAULT (global JwtAuthGuard). @Public() is an
 * explicit, greppable opt-out.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route/controller to the given roles (enforced by RolesGuard). */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/**
 * By default only ACTIVE accounts pass AccountStateGuard. Onboarding endpoints
 * (change password, complete profile, logout, me) widen the list explicitly.
 */
export const AllowAccountStates = (
  ...states: AccountState[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOWED_ACCOUNT_STATES_KEY, states);

/** Shortcut: any account state that can hold a session. */
export const AllowAnyAuthenticatedState = (): MethodDecorator &
  ClassDecorator => AllowAccountStates(...AUTHENTICABLE_ACCOUNT_STATES);

export function getAuthenticatedUser(req: Request): AuthenticatedUser {
  const user: unknown = req.user;
  if (!isAuthenticatedUser(user)) throw new AuthenticationRequiredError();
  return user;
}

/**
 * The authenticated principal. Use its userId for ownership: "own" resources are
 * NEVER addressed by an id coming from the client.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser =>
    getAuthenticatedUser(ctx.switchToHttp().getRequest<Request>()),
);
