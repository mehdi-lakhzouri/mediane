import { api } from "./client";

export type DeviceStatus = "ACTIVE" | "REVOKED";

export interface AdminDevice {
  associationId: string;
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

/** A complete operational snapshot for fleet-wide counts, filters and sorting. */
export async function listAllAdminDevices(): Promise<AdminDevice[]> {
  const first = await listAdminDevices({ page: 1, pageSize: 100 });
  const items = [...first.items];
  // Bound concurrency while preserving the API's pagination order.
  const pages = Math.ceil(first.totalItems / 100);
  for (let page = 2; page <= pages; page += 4) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(4, pages - page + 1) }, (_, index) =>
        listAdminDevices({ page: page + index, pageSize: 100 }),
      ),
    );
    for (const result of batch) {
      if (result.totalItems !== first.totalItems) {
        throw new Error(
          "Device inventory changed during refresh; retrying on the next poll.",
        );
      }
      items.push(...result.items);
    }
  }
  const unique = [...new Map(items.map((item) => [item.id, item])).values()];
  if (unique.length !== first.totalItems) {
    throw new Error("Incomplete device inventory; retrying on the next poll.");
  }
  return unique;
}
