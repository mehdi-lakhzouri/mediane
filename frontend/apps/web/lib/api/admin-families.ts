import { api } from "./client";

export type FamilyRole = "OWNER" | "MEMBER";

export interface FamilyPerson {
  userId: string;
  firstName: string;
  lastName: string;
}

export interface AdminFamilyMember extends FamilyPerson {
  role: FamilyRole;
  joinedAt: string;
}

/**
 * The console sees who belongs to a family, never what members share with
 * each other (phone, incidents, health).
 */
export interface AdminFamily {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  owner: FamilyPerson | null;
  /** Detail view only. */
  members?: AdminFamilyMember[];
  pendingRequestCount?: number;
}

export interface FamiliesPage {
  items: AdminFamily[];
  totalItems: number;
}

/** Same limit as the API (FamilyPolicy.MAX_MEMBERS). */
export const FAMILY_MAX_MEMBERS = 10;

export async function listFamilies(params: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<FamiliesPage> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.search) query.set("search", params.search);
  const envelope = await api.getWithMeta<AdminFamily[]>(
    `/admin/families?${query.toString()}`,
  );
  return {
    items: envelope.data ?? [],
    totalItems: envelope.meta.pagination?.totalItems ?? 0,
  };
}

export function getFamily(familyId: string): Promise<AdminFamily> {
  return api.get<AdminFamily>(`/admin/families/${familyId}`);
}

export function addFamilyMember(
  familyId: string,
  userId: string,
): Promise<AdminFamily> {
  return api.post<AdminFamily>(`/admin/families/${familyId}/members`, {
    userId,
  });
}

/** Null when removing the last member dissolved the family. */
export function removeFamilyMember(
  familyId: string,
  userId: string,
): Promise<AdminFamily | null> {
  return api.delete<AdminFamily | null>(
    `/admin/families/${familyId}/members/${userId}`,
  );
}

export function setFamilyOwner(
  familyId: string,
  userId: string,
): Promise<AdminFamily> {
  return api.post<AdminFamily>(`/admin/families/${familyId}/owner`, {
    userId,
  });
}

export function dissolveFamily(familyId: string): Promise<null> {
  return api.delete<null>(`/admin/families/${familyId}`);
}
