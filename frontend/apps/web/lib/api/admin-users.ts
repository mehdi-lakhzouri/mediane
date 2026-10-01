import { api } from "./client";
import type { Role } from "./auth";

export type UserStatus = "INVITED" | "ACTIVE" | "SUSPENDED";

export type AccountState =
  | "INVITED"
  | "PASSWORD_CHANGE_REQUIRED"
  | "PROFILE_SETUP_REQUIRED"
  | "ACTIVE"
  | "SUSPENDED"
  | "DELETED";

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  accountState: AccountState;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export type UserSortField =
  "createdAt" | "email" | "lastName" | "status" | "lastLoginAt";

export interface ListUsersParams {
  page: number;
  pageSize: number;
  search?: string;
  role?: Role;
  status?: UserStatus;
  includeDeleted?: boolean;
  sortBy?: UserSortField;
  sortDir?: "asc" | "desc";
}

export interface UsersPage {
  items: AdminUser[];
  totalItems: number;
}

export interface InvitationStatus {
  invitationId: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "SUPERSEDED" | "EXPIRED";
  invitedBy: string | null;
  expiresAt: string;
  createdAt: string;
}

function query(params: ListUsersParams): string {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.search) search.set("search", params.search);
  if (params.role) search.set("role", params.role);
  if (params.status) search.set("status", params.status);
  if (params.includeDeleted) search.set("includeDeleted", "true");
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.sortDir) search.set("sortDir", params.sortDir);
  return search.toString();
}

/** The list endpoint returns pagination in `meta`, so this one reads the envelope. */
export async function listUsers(params: ListUsersParams): Promise<UsersPage> {
  const { data, meta } = await api.getWithMeta<AdminUser[]>(
    `/admin/users?${query(params)}`,
  );
  return {
    items: data ?? [],
    totalItems: meta.pagination?.totalItems ?? 0,
  };
}

export function getUser(userId: string): Promise<AdminUser> {
  return api.get<AdminUser>(`/admin/users/${userId}`);
}

export function createUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}): Promise<AdminUser> {
  return api.post<AdminUser>("/admin/users", input);
}

export function updateUser(
  userId: string,
  patch: { firstName?: string; lastName?: string },
): Promise<AdminUser> {
  return api.patch<AdminUser>(`/admin/users/${userId}`, patch);
}

export function suspendUser(userId: string): Promise<AdminUser> {
  return api.post<AdminUser>(`/admin/users/${userId}/suspend`);
}

export function reactivateUser(userId: string): Promise<AdminUser> {
  return api.post<AdminUser>(`/admin/users/${userId}/reactivate`);
}

export function softDeleteUser(userId: string): Promise<null> {
  return api.delete<null>(`/admin/users/${userId}`);
}

export function restoreUser(userId: string): Promise<AdminUser> {
  return api.post<AdminUser>(`/admin/users/${userId}/restore`);
}

/** Irreversible, and only valid once the account is already deleted. */
export function hardDeleteUser(
  userId: string,
  confirmEmail: string,
): Promise<null> {
  return api.post<null>(`/admin/users/${userId}/hard-delete`, { confirmEmail });
}

export function resendInvitation(userId: string): Promise<AdminUser> {
  return api.post<AdminUser>(`/admin/users/${userId}/invitation/resend`);
}

export function revokeInvitation(userId: string): Promise<InvitationStatus> {
  return api.post<InvitationStatus>(`/admin/users/${userId}/invitation/revoke`);
}

export function getInvitationStatus(userId: string): Promise<InvitationStatus> {
  return api.get<InvitationStatus>(`/admin/users/${userId}/invitation`);
}
