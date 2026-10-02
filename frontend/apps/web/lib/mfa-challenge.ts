/**
 * The pending second sign-in step, handed from the sign-in form to the code
 * screen. Kept in memory only (not in sessionStorage): it is a short-lived
 * credential, and a page reload simply sends the user back to sign in.
 */
export interface PendingMfaChallenge {
  mfaToken: string;
  expiresAt: Date;
}

let pending: PendingMfaChallenge | null = null;

export function holdMfaChallenge(challenge: PendingMfaChallenge): void {
  pending = challenge;
}

/** The challenge if it is still valid, otherwise null. */
export function pendingMfaChallenge(): PendingMfaChallenge | null {
  if (pending && pending.expiresAt.getTime() <= Date.now()) pending = null;
  return pending;
}

export function clearMfaChallenge(): void {
  pending = null;
}
