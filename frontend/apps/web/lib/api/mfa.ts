import { api } from "./client";
import type { AccountState } from "./auth";

export interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  required: boolean;
  recoveryCodesRemaining: number;
  recoveryCodesLow: boolean;
}

export interface TotpSetup {
  /** Base32 key for manual entry. */
  secret: string;
  /** Rendered as the QR code. */
  otpauthUri: string;
  issuer: string;
  accountName: string;
  period: number;
  expiresAt: string;
}

export interface RecoveryCodes {
  /** Shown once: the API only keeps their hashes. */
  recoveryCodes: string[];
  accountState: AccountState;
}

export function getMfaStatus(): Promise<MfaStatus> {
  return api.get<MfaStatus>("/auth/mfa");
}

/** `code` is only needed to replace an authenticator that is already active. */
export function startTotpSetup(code?: string): Promise<TotpSetup> {
  return api.post<TotpSetup>("/auth/mfa/totp/setup", code ? { code } : {});
}

export function confirmTotpSetup(code: string): Promise<RecoveryCodes> {
  return api.post<RecoveryCodes>("/auth/mfa/totp/confirm", { code });
}

export function regenerateRecoveryCodes(code: string): Promise<RecoveryCodes> {
  return api.post<RecoveryCodes>("/auth/mfa/recovery-codes", { code });
}

/** Turns two-step verification off; needs a current or recovery code. */
export function disableMfa(code: string): Promise<MfaStatus> {
  return api.post<MfaStatus>("/auth/mfa/totp/disable", { code });
}
