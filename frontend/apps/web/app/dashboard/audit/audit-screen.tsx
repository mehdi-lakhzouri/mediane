"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ColumnDef,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import {
  Bot,
  CarFront,
  ClipboardList,
  Download,
  Eye,
  MoreVertical,
  RefreshCcw,
  Search,
  TerminalSquare,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { DataTable } from "../../components/data-table/data-table";
import {
  actorTypeLabel,
  AuditCategoryBadge,
  AuditOutcomeBadge,
  formatAuditAction,
} from "../../components/dashboard/audit/audit-badges";
import { AuditSheet } from "../../components/dashboard/audit/audit-sheet";
import { AuditStats } from "../../components/dashboard/audit/audit-stats";
import {
  formatDateTime,
  fullName,
  initials,
} from "../../components/dashboard/users/format";
import {
  getAdminAuditStats,
  listAdminAudit,
  type AdminAuditEntry,
  type AdminAuditStats,
  type AuditActorType,
  type AuditCategory,
  type AuditOutcome,
} from "../../../lib/api/admin-audit";
import { ApiError } from "../../../lib/api/client";

type CategoryFilter = AuditCategory | "ALL";
type OutcomeFilter = AuditOutcome | "ALL";
type ActorFilter = AuditActorType | "ALL";
type RangeFilter = "ALL" | "24H" | "7D" | "30D";

export function AuditScreen() {
  const [rows, setRows] = useState<AdminAuditEntry[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<AdminAuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("ALL");
  const [actorFilter, setActorFilter] = useState<ActorFilter>("ALL");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("7D");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selected, setSelected] = useState<AdminAuditEntry | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((previous) => ({ ...previous, pageIndex: 0 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const sortDir = sorting[0]?.desc === false ? "asc" : "desc";

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const page = await listAdminAudit({
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        search: search || undefined,
        category: categoryFilter === "ALL" ? undefined : categoryFilter,
        outcome: outcomeFilter === "ALL" ? undefined : outcomeFilter,
        actorType: actorFilter === "ALL" ? undefined : actorFilter,
        from: fromForRange(rangeFilter),
        sortDir,
      });
      if (id !== requestId.current) return;
      setRows(page.items);
      setTotalItems(page.totalItems);
      setLoadError(null);
    } catch (error) {
      if (id !== requestId.current) return;
      setRows([]);
      setTotalItems(0);
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "Could not load the audit log. Please try again.",
      );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [
    actorFilter,
    categoryFilter,
    outcomeFilter,
    pagination.pageIndex,
    pagination.pageSize,
    rangeFilter,
    search,
    sortDir,
  ]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await getAdminAuditStats());
    } catch {
      // The event log remains available if aggregate metrics fail.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const columns = useMemo<ColumnDef<AdminAuditEntry>[]>(
    () => [
      {
        id: "createdAt",
        size: 185,
        header: "Timestamp",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "action",
        size: 300,
        header: "Event",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">
              {formatAuditAction(row.original.action)}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
              {row.original.action}
            </p>
          </div>
        ),
      },
      {
        id: "category",
        size: 125,
        header: "Category",
        enableSorting: false,
        cell: ({ row }) => (
          <AuditCategoryBadge category={row.original.category} />
        ),
      },
      {
        id: "actor",
        size: 230,
        header: "Actor",
        enableSorting: false,
        cell: ({ row }) => <ActorCell entry={row.original} />,
      },
      {
        id: "target",
        size: 150,
        header: "Target",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-foreground">
              {row.original.targetType ?? "—"}
            </p>
            <p className="mt-0.5 max-w-[130px] truncate font-mono text-[10px] text-muted-foreground">
              {row.original.targetId ?? "No target"}
            </p>
          </div>
        ),
      },
      {
        id: "outcome",
        size: 110,
        header: "Outcome",
        enableSorting: false,
        cell: ({ row }) => <AuditOutcomeBadge outcome={row.original.outcome} />,
      },
      {
        id: "ipAddress",
        size: 135,
        header: "Source",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-muted-foreground">
            {row.original.ipAddress ?? "—"}
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
                aria-label={`View ${formatAuditAction(row.original.action)}`}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[190px]">
              <DropdownMenuItem onSelect={() => setSelected(row.original)}>
                <Eye /> View event details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  function resetPage() {
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.035em] text-foreground">
            Audit log
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Investigate security, access and administrative activity across
            CabinGuard.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={rows.length === 0}
            onClick={() => exportAuditRows(rows)}
            className="h-[46px] rounded-[9px] bg-white px-4"
          >
            <Download /> Export page
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={loading}
            onClick={() => {
              void load();
              void loadStats();
            }}
            className="h-[46px] rounded-[9px] bg-white px-4"
          >
            <RefreshCcw className={loading ? "animate-spin" : undefined} />
            Refresh
          </Button>
        </div>
      </div>

      <AuditStats stats={stats} />

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
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[280px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search action, request ID, IP or exact UUID..."
                aria-label="Search audit events"
                className="h-11 rounded-[9px] bg-white pl-11"
              />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(value) => {
                setCategoryFilter(value as CategoryFilter);
                resetPage();
              }}
            >
              <SelectTrigger
                aria-label="Filter by category"
                className="h-11 w-[160px] rounded-[9px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                <SelectItem value="ACCOUNT">Account</SelectItem>
                <SelectItem value="ACCESS">Access</SelectItem>
                <SelectItem value="SECURITY">Security</SelectItem>
                <SelectItem value="FAMILY">Family</SelectItem>
                <SelectItem value="DEVICE">Device</SelectItem>
                <SelectItem value="SAFETY">Safety</SelectItem>
                <SelectItem value="SYSTEM">System</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={outcomeFilter}
              onValueChange={(value) => {
                setOutcomeFilter(value as OutcomeFilter);
                resetPage();
              }}
            >
              <SelectTrigger
                aria-label="Filter by outcome"
                className="h-11 w-[145px] rounded-[9px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Any outcome</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="FAILURE">Failure</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={actorFilter}
              onValueChange={(value) => {
                setActorFilter(value as ActorFilter);
                resetPage();
              }}
            >
              <SelectTrigger
                aria-label="Filter by actor"
                className="h-11 w-[145px] rounded-[9px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All actors</SelectItem>
                <SelectItem value="USER">Users</SelectItem>
                <SelectItem value="SYSTEM">System</SelectItem>
                <SelectItem value="CLI">Command line</SelectItem>
                <SelectItem value="DEVICE">Devices</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={rangeFilter}
              onValueChange={(value) => {
                setRangeFilter(value as RangeFilter);
                resetPage();
              }}
            >
              <SelectTrigger
                aria-label="Filter by time range"
                className="h-11 w-[145px] rounded-[9px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24H">Last 24 hours</SelectItem>
                <SelectItem value="7D">Last 7 days</SelectItem>
                <SelectItem value="30D">Last 30 days</SelectItem>
                <SelectItem value="ALL">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        emptyState={
          <div className="grid h-52 place-items-center px-6 text-center">
            <div>
              <span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary">
                <ClipboardList className="size-5 text-primary" />
              </span>
              <p className="mt-3 text-[14px] font-semibold text-foreground">
                {loadError ?? "No audit event matches these filters"}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {loadError
                  ? "Check that the API is reachable, then refresh the log."
                  : "Try a longer time range or clear one of the filters."}
              </p>
            </div>
          </div>
        }
      />

      <AuditSheet
        entry={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}

function ActorCell({ entry }: { entry: AdminAuditEntry }) {
  if (entry.actor) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef3ff] text-[10px] font-bold text-primary">
          {initials(entry.actor)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-foreground">
            {fullName(entry.actor)}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {entry.actor.email}
          </p>
        </div>
      </div>
    );
  }

  const Icon =
    entry.actorType === "DEVICE"
      ? CarFront
      : entry.actorType === "CLI"
        ? TerminalSquare
        : Bot;
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-lg bg-[#f0f3f8] text-[#526180]">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-[12px] font-medium text-foreground">
          {actorTypeLabel(entry.actorType)}
        </p>
        {entry.actorUserId ? (
          <p className="max-w-[130px] truncate font-mono text-[9px] text-muted-foreground">
            Deleted account · {entry.actorUserId}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function fromForRange(range: RangeFilter): string | undefined {
  if (range === "ALL") return undefined;
  const hours = range === "24H" ? 24 : range === "7D" ? 24 * 7 : 24 * 30;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function exportAuditRows(rows: AdminAuditEntry[]): void {
  const header = [
    "timestamp",
    "action",
    "category",
    "outcome",
    "actor_type",
    "actor",
    "target_type",
    "target_id",
    "request_id",
    "ip_address",
  ];
  const values = rows.map((entry) => [
    entry.createdAt,
    entry.action,
    entry.category,
    entry.outcome,
    entry.actorType,
    entry.actor ? `${fullName(entry.actor)} <${entry.actor.email}>` : "",
    entry.targetType ?? "",
    entry.targetId ?? "",
    entry.requestId ?? "",
    entry.ipAddress ?? "",
  ]);
  const csv = [header, ...values]
    .map((line) => line.map(csvCell).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `cabinguard-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
