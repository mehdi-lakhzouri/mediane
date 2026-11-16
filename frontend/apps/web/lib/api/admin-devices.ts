import { api } from "./client";

export type DeviceStatus = "ACTIVE" | "REVOKED";

export interface AdminDevice {
  associationId: string;
  aiMode: "SHADOW" | "ACTIVE";
  runtimeHealth: {
    runtimeVersion: string;
    bootId: string;
    queueDepth: number;
    cardiac: string;
    seizure: string;
    stroke: string;
  } | null;
  id: string;
  serialNumber: string;
  label: string;
  status: DeviceStatus;
  pairedUserId: string | null;
  pairedDriver: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  pairedAt: string | null;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
  secretRotatedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface AdminDevicesPage {
  items: AdminDevice[];
  totalItems: number;
}

export async function listAdminDevices(params: {
  page: number;
  pageSize: number;
  status?: DeviceStatus;
}): Promise<AdminDevicesPage> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.status) query.set("status", params.status);

  const { data, meta } = await api.getWithMeta<AdminDevice[]>(
    `/admin/devices?${query.toString()}`,
  );
  return {
    items: data ?? [],
    totalItems: meta.pagination?.totalItems ?? 0,
  };
}
