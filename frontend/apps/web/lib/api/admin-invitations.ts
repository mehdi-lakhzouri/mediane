import { api } from "./client";
import type { Role } from "./auth";
import type { UserStatus } from "./admin-users";

export type AdminInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REVOKED"
  | "SUPERSEDED"
  | "EXPIRED";

export type InvitationSortField =
  | "createdAt"
  | "expiresAt"
  | "status"
  | "email";

export interface AdminInvitation {
  invitationId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  userStatus: UserStatus;
  userDeletedAt: string | null;
  status: AdminInvitationStatus;
  invitedBy: {
    userId: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface AdminInvitationStats {
  total: number;
  pending: number;
  accepted: number;
  expired: number;
  revoked: number;
  superseded: number;
  acceptanceRate: number;
}

export interface AdminInvitationsPage {
  items: AdminInvitation[];
  totalItems: number;
}

export interface ListAdminInvitationsParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: AdminInvitationStatus;
  role?: Role;
  sortBy?: InvitationSortField;
  sortDir?: "asc" | "desc";
}

export async function listAdminInvitations(
  params: ListAdminInvitationsParams,
): Promise<AdminInvitationsPage> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.role) query.set("role", params.role);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortDir) query.set("sortDir", params.sortDir);

  const { data, meta } = await api.getWithMeta<AdminInvitation[]>(
    `/admin/invitations?${query.toString()}`,
  );
  return {
    items: data ?? [],
    totalItems: meta.pagination?.totalItems ?? 0,
  };
}

export function getAdminInvitationStats(): Promise<AdminInvitationStats> {
  return api.get<AdminInvitationStats>("/admin/invitations/stats");
}
