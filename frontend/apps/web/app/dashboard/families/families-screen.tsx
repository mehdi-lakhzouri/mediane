"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ColumnDef,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { Crown, Search, UsersRound } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Input } from "@repo/ui/components/ui/input";
import { DataTable } from "../../components/data-table/data-table";
import { FamilySheet } from "../../components/dashboard/families/family-sheet";
import { formatDate, fullName } from "../../components/dashboard/users/format";
import {
  FAMILY_MAX_MEMBERS,
  listFamilies,
  type AdminFamily,
} from "../../../lib/api/admin-families";
import { ApiError } from "../../../lib/api/client";

/**
 * Families drivers created in the mobile app. Read-mostly: the console fixes
 * membership when needed (lost owner, abuse) but never sees shared data.
 */
export function FamiliesScreen() {
  const [rows, setRows] = useState<AdminFamily[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  // The API orders by creation date; sorting is not offered here.
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selected, setSelected] = useState<AdminFamily | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const page = await listFamilies({
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        search: search || undefined,
      });
      if (id !== requestId.current) return;
      setRows(page.items);
      setTotalItems(page.totalItems);
      setLoadError(null);
    } catch (error) {
      if (id !== requestId.current) return;
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "Could not load families. Please try again.",
      );
      setRows([]);
      setTotalItems(0);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<ColumnDef<AdminFamily>[]>(
    () => [
      {
        id: "name",
        header: "Family",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eef3ff] text-[#2441d5]">
              <UsersRound className="size-[18px]" />
            </span>
            <span className="font-medium text-foreground">
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        id: "owner",
        header: "Owner",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.owner ? (
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <Crown className="size-3.5 text-[#c48a10]" />
              {fullName(row.original.owner)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "members",
        header: "Members",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.memberCount >= FAMILY_MAX_MEMBERS
                ? "warning"
                : "secondary"
            }
          >
            {row.original.memberCount} / {FAMILY_MAX_MEMBERS}
          </Badge>
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[32px] font-bold leading-tight tracking-[-0.035em] text-foreground">
          Families
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Drivers who look out for each other. They create and join families in
          the mobile app; you can step in when membership needs fixing.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowCount={totalItems}
        getRowId={(row) => row.id}
        pagination={pagination}
        onPaginationChange={setPagination}
        sorting={sorting}
        onSortingChange={setSorting}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        loading={loading}
        activeRowId={selected?.id}
        onRowClick={setSelected}
        toolbar={
          <div className="relative max-w-[440px]">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search a family or a member's name or email..."
              aria-label="Search families"
              className="h-11 rounded-[9px] bg-white pl-11"
            />
          </div>
        }
        emptyState={
          <div className="grid h-52 place-items-center px-6 text-center">
            <div>
              <span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary">
                <UsersRound className="size-5 text-primary" />
              </span>
              <p className="mt-3 text-[14px] font-semibold text-foreground">
                {loadError ??
                  (search
                    ? "No family matches this search"
                    : "No families yet")}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {loadError
                  ? "Check that the API is reachable and try again."
                  : "Families appear here once drivers create them in the mobile app."}
              </p>
            </div>
          </div>
        }
      />

      <FamilySheet
        family={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}
