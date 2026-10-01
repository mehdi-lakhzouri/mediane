import { api, refreshCsrfToken, setCsrfToken } from "./client";

export type Role = "ADMIN" | "DRIVER";

/** Only states that can hold a session are ever returned by the API. */
export type AccountState =
  "PASSWORD_CHANGE_REQUIRED" | "PROFILE_SETUP_REQUIRED" | "ACTIVE";

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
}

interface SessionOpened extends SessionPrincipal {
  /** Rotated by the API whenever a session is created. */
  csrfToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

function openSession(opened: SessionOpened): SessionPrincipal {
  setCsrfToken(opened.csrfToken);
  return {
    userId: opened.userId,
    role: opened.role,
    accountState: opened.accountState,
  };
}

/** GET /auth/csrf (fresh token + cookie) then POST /auth/login. */
export async function login(input: LoginInput): Promise<SessionPrincipal> {
  await refreshCsrfToken();
  return openSession(await api.post<SessionOpened>("/auth/login", input));
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

export function getCurrentUser(): Promise<CurrentUser> {
  return api.get<CurrentUser>("/auth/me");
}

export function fullName(user: CurrentUser): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function initials(user: CurrentUser): string {
  const letters = `${user.firstName.at(0) ?? ""}${user.lastName.at(0) ?? ""}`;
  return (letters || user.email.slice(0, 2)).toUpperCase();
}
