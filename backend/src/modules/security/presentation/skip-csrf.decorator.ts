import { SetMetadata } from '@nestjs/common';
import { SKIP_CSRF_KEY } from './csrf.constants';

/**
 * Opt-out of CSRF validation. Only for state-changing endpoints that are never
 * called by a browser with ambient cookies (e.g. machine-to-machine webhooks).
 */
export const SkipCsrf = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_CSRF_KEY, true);
