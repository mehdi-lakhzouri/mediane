"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ColumnDef,
  ExpandedState,
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Crown,
  MoreVertical,
  PanelRightOpen,
  RefreshCcw,
  Search,
  UsersRound,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { DataTable } from "../../components/data-table/data-table";
import {
  FamilyMembersRow,
  type FamilyDetailState,
} from "../../components/dashboard/families/family-members-row";
import { FamilySheet } from "../../components/dashboard/families/family-sheet";
import { FamilyStats } from "../../components/dashboard/families/family-stats";
import {
  ctaMotion,
  EASE,
  headerMotion,
  rowMotion,
  sectionMotion,
  stagger,
} from "../../components/dashboard/motion";
import { formatDate, fullName } from "../../components/dashboard/users/format";
import {
  FAMILY_MAX_MEMBERS,
  getFamily,
  getFamilyStats,
  listFamilies,
  type AdminFamily,
  type AdminFamilyStats,
} from "../../../lib/api/admin-families";
import { ApiError } from "../../../lib/api/client";

function apiError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Administrative family workspace. The list is server-paginated, while an
 * expanded row fetches that family's members only when an administrator asks
 * for them. Membership actions remain centralized in FamilySheet.
 */
export function FamiliesScreen() {
  const [rows, setRows] = useState<AdminFamily[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<AdminFamilyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [selected, setSelected] = useState<AdminFamily | null>(null);
  const [detailsById, setDetailsById] = useState<
    Record<string, FamilyDetailState>
  >({});

  const detailsRef = useRef<Record<string, FamilyDetailState>>({});
  const detailRequests = useRef(new Set<string>());
  const requestId = useRef(0);

  const storeDetails = useCallback(
    (familyId: string, state: FamilyDetailState) => {
      detailsRef.current = { ...detailsRef.current, [familyId]: state };
      setDetailsById(detailsRef.current);
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((previous) => ({ ...previous, pageIndex: 0 }));
      setExpanded({});
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
        apiError(error, "Could not load families. Please try again."),
      );
      setRows([]);
      setTotalItems(0);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, search]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await getFamilyStats());
    } catch {
      // The table remains usable if the aggregate endpoint is unavailable.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const loadFamilyDetails = useCallback(
    async (familyId: string, force = false) => {
      if (detailRequests.current.has(familyId)) return;
      if (!force && detailsRef.current[familyId]?.data) return;

      detailRequests.current.add(familyId);
      storeDetails(familyId, {
        data: force ? (detailsRef.current[familyId]?.data ?? null) : null,
        loading: true,
        error: null,
      });
      try {
        const data = await getFamily(familyId);
        storeDetails(familyId, { data, loading: false, error: null });
      } catch (error) {
        storeDetails(familyId, {
          data: null,
          loading: false,
          error: apiError(error, "Could not load this family's members."),
        });
      } finally {
        detailRequests.current.delete(familyId);
      }
    },
    [storeDetails],
  );

  const handlePaginationChange: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      setExpanded({});
      setPagination(updater);
    },
    [],
  );

  const columns = useMemo<ColumnDef<AdminFamily>[]>(
    () => [
      {
        id: "expand",
        size: 48,
        enableSorting: false,
        header: () => <span className="sr-only">Show members</span>,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${row.getIsExpanded() ? "Hide" : "Show"} members of ${row.original.name}`}
            aria-expanded={row.getIsExpanded()}
            className="rounded-lg text-[#536489] hover:bg-[#e9efff] hover:text-primary"
            onClick={() => {
              const next = !row.getIsExpanded();
              row.toggleExpanded(next);
              if (next) void loadFamilyDetails(row.original.id);
            }}
          >
            <motion.span
              className="grid place-items-center"
              initial={false}
              animate={{ rotate: row.getIsExpanded() ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
            >
              <ChevronRight />
            </motion.span>
          </Button>
        ),
      },
      {
        id: "name",
        size: 280,
        header: "Family",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eef3ff] text-[#2441d5]">
              <UsersRound className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {row.original.name}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Expand to inspect members
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "owner",
        size: 220,
        header: "Owner",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.owner ? (
            <div className="flex items-center gap-2">
              <Crown className="size-3.5 shrink-0 text-[#c48a10]" />
              <span className="truncate font-medium text-foreground">
                {fullName(row.original.owner)}
              </span>
            </div>
          ) : (
            <Badge variant="danger">Owner missing</Badge>
          ),
      },
      {
        id: "members",
        size: 170,
        header: "Capacity",
        enableSorting: false,
        cell: ({ row }) => {
          const percentage = Math.min(
            100,
            (row.original.memberCount / FAMILY_MAX_MEMBERS) * 100,
          );
          return (
            <div className="w-[132px]">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-foreground tabular-nums">
                  {row.original.memberCount} / {FAMILY_MAX_MEMBERS}
                </span>
                <span className="text-muted-foreground">
                  {Math.round(percentage)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e7ecf5]">
                <motion.div
                  className={`h-full rounded-full ${percentage >= 100 ? "bg-[#dc8b16]" : "bg-primary"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
                />
              </div>
            </div>
          );
        },
      },
      {
        id: "availability",
        size: 150,
        header: "Availability",
        enableSorting: false,
        cell: ({ row }) => {
          const places = Math.max(
            0,
            FAMILY_MAX_MEMBERS - row.original.memberCount,
          );
          return places === 0 ? (
            <Badge variant="warning">At capacity</Badge>
          ) : (
            <Badge variant="success">
              {places} open {places === 1 ? "place" : "places"}
            </Badge>
          );
        },
      },
      {
        id: "createdAt",
        size: 140,
        header: "Created",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        size: 56,
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${row.original.name}`}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[190px]">
              <DropdownMenuItem onSelect={() => setSelected(row.original)}>
                <PanelRightOpen /> View and manage
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [loadFamilyDetails],
  );

  const refreshWorkspace = useCallback(() => {
    detailsRef.current = {};
    setDetailsById({});
    setExpanded({});
    void load();
    void loadStats();
  }, [load, loadStats]);

  return (
    <motion.div
      variants={stagger(0.1)}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div variants={headerMotion.families.title}>
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.035em] text-foreground">
            Families
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Monitor family capacity, inspect membership and resolve account
            access issues.
          </p>
        </motion.div>
        <motion.div
          variants={headerMotion.families.actions}
          className="inline-flex"
        >
          <motion.div {...ctaMotion} className="inline-flex">
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={loading}
              onClick={refreshWorkspace}
              className="h-[46px] rounded-[9px] bg-white px-5"
            >
              <RefreshCcw className={loading ? "animate-spin" : undefined} />
              Refresh workspace
            </Button>
          </motion.div>
        </motion.div>
      </div>

      <FamilyStats stats={stats} />

      <motion.div variants={sectionMotion}>
        <DataTable
          rowVariants={rowMotion.gather}
          columns={columns}
          data={rows}
          rowCount={totalItems}
          getRowId={(row) => row.id}
          pagination={pagination}
          onPaginationChange={handlePaginationChange}
          sorting={sorting}
          onSortingChange={setSorting}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          expanded={expanded}
          onExpandedChange={setExpanded}
          getRowCanExpand={() => true}
          loading={loading}
          activeRowId={selected?.id}
          onRowClick={setSelected}
          renderSubComponent={(row) => (
            <FamilyMembersRow
              family={row.original}
              state={detailsById[row.original.id]}
              onRetry={() => void loadFamilyDetails(row.original.id, true)}
              onManage={() => setSelected(row.original)}
            />
          )}
          toolbar={
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="relative min-w-[260px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search family, member name or email..."
                  aria-label="Search families"
                  className="h-11 rounded-[9px] bg-white pl-11"
                />
              </div>
              <div className="flex h-11 items-center gap-2 rounded-[9px] border border-border bg-white px-3 text-[12px] text-muted-foreground">
                <ChevronRight className="size-4 text-primary" />
                Expand a row to see members and roles
              </div>
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
                    ? "Check that the API is reachable, then refresh the workspace."
                    : "Families appear here when drivers create them in the mobile app."}
                </p>
              </div>
            </div>
          }
        />
      </motion.div>

      <FamilySheet
        family={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        onChanged={refreshWorkspace}
      />
    </motion.div>
  );
}
