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
  AuditCategoryBadge,
  AuditOutcomeBadge,
} from "../../components/dashboard/audit/audit-badges";
import { AuditSheet } from "../../components/dashboard/audit/audit-sheet";
import { AuditStats } from "../../components/dashboard/audit/audit-stats";
import {
  auditActionLabel,
  labelMessages,
  type Labels,
} from "../../components/dashboard/labels";
import { fullName, initials } from "../../components/dashboard/users/format";
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
import { useErrorText } from "../../../lib/i18n/api-errors";
import { useFormatters, useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";

const messages = defineMessages({
  en: {
    title: "Audit log",
    subtitle:
      "Investigate security, access and administrative activity across CabinGuard.",
    export: "Export page",
    refresh: "Refresh",
    columns: {
      timestamp: "Timestamp",
      event: "Event",
      category: "Category",
      actor: "Actor",
      target: "Target",
      outcome: "Outcome",
      source: "Source",
      actions: "Actions",
    },
    noTarget: "No target",
    view: (action: string) => `View ${action}`,
    viewDetails: "View event details",
    deletedAccount: "Deleted account",
    search: "Search action, request ID, IP or exact UUID...",
    searchLabel: "Search audit events",
    filters: {
      category: "Filter by category",
      allCategories: "All categories",
      outcome: "Filter by outcome",
      anyOutcome: "Any outcome",
      actor: "Filter by actor",
      allActors: "All actors",
      users: "Users",
      devices: "Devices",
      range: "Filter by time range",
      last24h: "Last 24 hours",
      last7d: "Last 7 days",
      last30d: "Last 30 days",
      allTime: "All time",
    },
    loadFailed: "Could not load the audit log. Please try again.",
    empty: "No audit event matches these filters",
    emptyHint: "Try a longer time range or clear one of the filters.",
    errorHint: "Check that the API is reachable, then refresh the log.",
  },
  fr: {
    title: "Journal d’audit",
    subtitle:
      "Analysez l’activité de sécurité, d’accès et d’administration sur CabinGuard.",
    export: "Exporter la page",
    refresh: "Actualiser",
    columns: {
      timestamp: "Horodatage",
      event: "Événement",
      category: "Catégorie",
      actor: "Acteur",
      target: "Cible",
      outcome: "Résultat",
      source: "Source",
      actions: "Actions",
    },
    noTarget: "Aucune cible",
    view: (action: string) => `Voir ${action}`,
    viewDetails: "Voir le détail de l’événement",
    deletedAccount: "Compte supprimé",
    search: "Action, ID de requête, IP ou UUID…",
    searchLabel: "Rechercher des événements d’audit",
    filters: {
      category: "Filtrer par catégorie",
      allCategories: "Toutes les catégories",
      outcome: "Filtrer par résultat",
      anyOutcome: "Tous les résultats",
      actor: "Filtrer par acteur",
      allActors: "Tous les acteurs",
      users: "Utilisateurs",
      devices: "Appareils",
      range: "Filtrer par période",
      last24h: "Dernières 24 heures",
      last7d: "7 derniers jours",
      last30d: "30 derniers jours",
      allTime: "Depuis le début",
    },
    loadFailed: "Impossible de charger le journal d’audit. Veuillez réessayer.",
    empty: "Aucun événement d’audit ne correspond à ces filtres",
    emptyHint: "Essayez une période plus longue ou retirez un filtre.",
    errorHint: "Vérifiez que l’API est joignable, puis actualisez le journal.",
  },
});

type CategoryFilter = AuditCategory | "ALL";
type OutcomeFilter = AuditOutcome | "ALL";
type ActorFilter = AuditActorType | "ALL";
type RangeFilter = "ALL" | "24H" | "7D" | "30D";

export function AuditScreen() {
  const t = useMessages(messages);
  const labels = useMessages(labelMessages);
  const format = useFormatters();
  const errorText = useErrorText();
  const [rows, setRows] = useState<AdminAuditEntry[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<AdminAuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  // The failure, not its text: the message follows a language switch.
  const [loadError, setLoadError] = useState<{ error: unknown } | null>(null);
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
      setLoadError({ error });
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
        header: t.columns.timestamp,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {format.dateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "action",
        size: 300,
        header: t.columns.event,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">
              {auditActionLabel(labels, row.original.action)}
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
        header: t.columns.category,
        enableSorting: false,
        cell: ({ row }) => (
          <AuditCategoryBadge category={row.original.category} />
        ),
      },
      {
        id: "actor",
        size: 230,
        header: t.columns.actor,
        enableSorting: false,
        cell: ({ row }) => (
          <ActorCell
            entry={row.original}
            labels={labels}
            deletedAccount={t.deletedAccount}
          />
        ),
      },
      {
        id: "target",
        size: 150,
        header: t.columns.target,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-foreground">
              {row.original.targetType
                ? labels.targetType[row.original.targetType]
                : "—"}
            </p>
            <p className="mt-0.5 max-w-[130px] truncate font-mono text-[10px] text-muted-foreground">
              {row.original.targetId ?? t.noTarget}
            </p>
          </div>
        ),
      },
      {
        id: "outcome",
        size: 110,
        header: t.columns.outcome,
        enableSorting: false,
        cell: ({ row }) => <AuditOutcomeBadge outcome={row.original.outcome} />,
      },
      {
        id: "ipAddress",
        size: 135,
        header: t.columns.source,
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
        header: () => <span className="sr-only">{t.columns.actions}</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t.view(
                  auditActionLabel(labels, row.original.action),
                )}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[190px]">
              <DropdownMenuItem onSelect={() => setSelected(row.original)}>
                <Eye /> {t.viewDetails}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [format, labels, t],
  );

  function resetPage() {
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.035em] text-foreground">
            {t.title}
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">{t.subtitle}</p>
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
            <Download /> {t.export}
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
            {t.refresh}
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
                placeholder={t.search}
                aria-label={t.searchLabel}
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
                aria-label={t.filters.category}
                className="h-11 w-[160px] rounded-[9px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t.filters.allCategories}</SelectItem>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {labels.auditCategory[category]}
                  </SelectItem>
                ))}
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
                aria-label={t.filters.outcome}
                className="h-11 w-[145px] rounded-[9px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t.filters.anyOutcome}</SelectItem>
                <SelectItem value="SUCCESS">
                  {labels.auditOutcome.SUCCESS}
                </SelectItem>
                <SelectItem value="FAILURE">
                  {labels.auditOutcome.FAILURE}
                </SelectItem>
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
                aria-label={t.filters.actor}
                className="h-11 w-[145px] rounded-[9px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t.filters.allActors}</SelectItem>
                <SelectItem value="USER">{t.filters.users}</SelectItem>
                <SelectItem value="SYSTEM">
                  {labels.actorType.SYSTEM}
                </SelectItem>
                <SelectItem value="CLI">{labels.actorType.CLI}</SelectItem>
                <SelectItem value="DEVICE">{t.filters.devices}</SelectItem>
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
                aria-label={t.filters.range}
                className="h-11 w-[145px] rounded-[9px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24H">{t.filters.last24h}</SelectItem>
                <SelectItem value="7D">{t.filters.last7d}</SelectItem>
                <SelectItem value="30D">{t.filters.last30d}</SelectItem>
                <SelectItem value="ALL">{t.filters.allTime}</SelectItem>
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
                {loadError
                  ? loadError.error instanceof ApiError
                    ? errorText.message(loadError.error)
                    : t.loadFailed
                  : t.empty}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {loadError ? t.errorHint : t.emptyHint}
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

const CATEGORIES: AuditCategory[] = [
  "ACCOUNT",
  "ACCESS",
  "SECURITY",
  "FAMILY",
  "DEVICE",
  "SAFETY",
  "SYSTEM",
];

function ActorCell({
  entry,
  labels,
  deletedAccount,
}: {
  entry: AdminAuditEntry;
  labels: Labels;
  deletedAccount: string;
}) {
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
          {labels.actorType[entry.actorType]}
        </p>
        {entry.actorUserId ? (
          <p className="max-w-[130px] truncate font-mono text-[9px] text-muted-foreground">
            {deletedAccount} · {entry.actorUserId}
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
