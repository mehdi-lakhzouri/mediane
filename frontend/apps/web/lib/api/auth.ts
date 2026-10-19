import { api, refreshCsrfToken, setCsrfToken } from "./client";

export type Role = "ADMIN" | "DRIVER";

/** Only states that can hold a session are ever returned by the API. */
export type AccountState =
  | "PASSWORD_CHANGE_REQUIRED"
  | "MFA_SETUP_REQUIRED"
  | "PROFILE_SETUP_REQUIRED"
  | "ACTIVE";

export interface SessionPrincipal {
  userId: string;
  role: Role;
  accountState: AccountState;
}

/** GET /auth/me: the caller's own identity, for the account menu. */
export interface CurrentUser extends SessionPrincipal {
  email: string;
  firstName: string;
  lastName: string;
  sessionPolicy: WebSessionPolicy;
}

export interface WebSessionPolicy {
  idleTimeoutSeconds: number;
  warningSeconds: number;
  countdownSeconds: number;
  activityHeartbeatSeconds: number;
}

interface SessionOpened extends SessionPrincipal {
  /** Rotated by the API whenever a session is created. */
  csrfToken: string;
}

type LoginResponse =
  | (SessionOpened & { mfaRequired: false })
  | { mfaRequired: true; mfaToken: string; expiresAt: string };

/** A correct password either opens the session or asks for the second factor. */
export type LoginOutcome =
  | { kind: "session"; principal: SessionPrincipal }
  | { kind: "mfa"; mfaToken: string; expiresAt: Date };

export interface LoginInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  /** Only when two-step verification is on. */
  mfaCode?: string;
}

function openSession(opened: SessionOpened): SessionPrincipal {
  setCsrfToken(opened.csrfToken);
  return {
    userId: opened.userId,
    role: opened.role,
    accountState: opened.accountState,
  };
}

/**
 * Where an authenticated administrator must go next. The API enforces the
 * same order server-side; this only avoids showing a screen that would 403.
 */
export function destinationFor(state: AccountState): string {
  switch (state) {
    case "PASSWORD_CHANGE_REQUIRED":
      return "/change-password";
    case "MFA_SETUP_REQUIRED":
      return "/mfa/setup";
    default:
      return "/dashboard";
  }
}

/** GET /auth/csrf (fresh token + cookie) then POST /auth/login. */
export async function login(input: LoginInput): Promise<LoginOutcome> {
  await refreshCsrfToken();
  const response = await api.post<LoginResponse>("/auth/login", input);
  if (response.mfaRequired) {
    return {
      kind: "mfa",
      mfaToken: response.mfaToken,
      expiresAt: new Date(response.expiresAt),
    };
  }
  return { kind: "session", principal: openSession(response) };
}

/** Second sign-in step: authenticator code or recovery code. */
export async function completeMfaChallenge(
  mfaToken: string,
  code: string,
): Promise<SessionPrincipal> {
  return openSession(
    await api.post<SessionOpened>("/auth/mfa/challenge", { mfaToken, code }),
  );
}

/** Every session is replaced; the response carries the new one. */
export async function changePassword(
  input: ChangePasswordInput,
): Promise<SessionPrincipal> {
  return openSession(
    await api.post<SessionOpened>("/auth/password/change", input),
  );
}

/** Always resolves the same way whether the address exists, preventing account enumeration. */
export async function requestPasswordReset(email: string): Promise<void> {
  await api.post<null>("/auth/password/forgot", { email });
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await api.post<null>("/auth/password/reset", { token, newPassword });
}

export async function logout(): Promise<void> {
  await api.post<null>("/auth/logout");
  setCsrfToken(null);
}

/** Revoke every web and mobile session owned by the current account. */
export async function logoutAll(): Promise<void> {
  await api.post<null>("/auth/logout-all");
  setCsrfToken(null);
}

export function getCurrentUser(): Promise<CurrentUser> {
  return api.get<CurrentUser>("/auth/me");
}

/** Extend the server-side web inactivity window without rotating tokens. */
export function recordDashboardActivity(): Promise<{ expiresAt: string }> {
  return api.post<{ expiresAt: string }>("/auth/activity");
}

export function fullName(user: CurrentUser): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function initials(user: CurrentUser): string {
  const letters = `${user.firstName.at(0) ?? ""}${user.lastName.at(0) ?? ""}`;
  return (letters || user.email.slice(0, 2)).toUpperCase();
}
