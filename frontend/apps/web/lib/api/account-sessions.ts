import { api } from "./client";

export type SessionChannel = "WEB" | "MOBILE";
export type DevicePlatform =
  | "ANDROID"
  | "IOS"
  | "WINDOWS"
  | "MACOS"
  | "LINUX"
  | "UNKNOWN";

export interface AccountSession {
  id: string;
  channel: SessionChannel;
  device: {
    label: string;
    platform: DevicePlatform;
    app: boolean;
  };
  ipAddress: string | null;
  signedInAt: string;
  lastActiveAt: string;
  current: boolean;
}

/** The caller's active sessions, most recently active first. */
export function listAccountSessions(): Promise<AccountSession[]> {
  return api.get<AccountSession[]>("/auth/sessions");
}

/** End one session owned by the caller. The current session is rejected by the API. */
export function revokeAccountSession(sessionId: string): Promise<null> {
  return api.delete<null>(`/auth/sessions/${sessionId}`);
}

/** End every session except the one making this request. */
export function revokeOtherAccountSessions(): Promise<{ revoked: number }> {
  return api.post<{ revoked: number }>("/auth/sessions/revoke-others");
}
