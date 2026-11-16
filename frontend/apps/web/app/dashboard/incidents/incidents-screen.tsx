"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type {
  ColumnDef,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpRight,
  BellRing,
  Info,
  Layers3,
  Search,
  Siren,
  X,
} from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { DataTable } from "../../components/data-table/data-table";
import { LiveRefresh } from "../../components/dashboard/live-refresh";
import {
  headerMotion,
  rowMotion,
  sectionMotion,
  stagger,
} from "../../components/dashboard/motion";
import { fullName, initials } from "../../components/dashboard/users/format";
import {
  getAdminIncidentStats,
  incidentReference,
  INCIDENT_STATUSES,
  listAdminIncidents,
  type AdminIncident,
  type AdminIncidentStats,
  type IncidentListParams,
  type IncidentPeriod,
  type IncidentStatus,
} from "../../../lib/api/admin-incidents";
import { useFormatters, useMessages } from "../../../lib/i18n/locale-provider";
import { IncidentStatusBadge } from "./incident-badges";
import { IncidentSheet } from "./incident-sheet";
import { IncidentStats } from "./incident-stats";
import { incidentMessages } from "./incidents.messages";

export function IncidentsScreen() {
  const t = useMessages(incidentMessages);
  const format = useFormatters();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<IncidentStatus | "ALL">("ALL");
  const [period, setPeriod] = useState<IncidentPeriod | "ALL">("ALL");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "openedAt", desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    key: string;
    items: AdminIncident[];
    totalItems: number;
    stats: AdminIncidentStats;
    at: number;
  } | null>(null);
  const sortBy =
    (["openedAt", "status", "driver", "respondBy"] as const).find(
      (field) => field === sorting[0]?.id,
    ) ?? "openedAt";
  const sortDir = sorting[0]?.desc === false ? "asc" : "desc";
  const params = useMemo<IncidentListParams>(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: search || undefined,
      status: status === "ALL" ? undefined : status,
      period: period === "ALL" ? undefined : period,
      sortBy,
      sortDir,
    }),
    [
      pagination.pageIndex,
      pagination.pageSize,
      search,
      status,
      period,
      sortBy,
      sortDir,
    ],
  );
  const key = JSON.stringify(params);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((previous) =>
        previous.pageIndex === 0 ? previous : { ...previous, pageIndex: 0 },
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    let cancelled = false,
      inFlight = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      setFetching(true);
      try {
        const [page, stats] = await Promise.all([
          listAdminIncidents(params),
          getAdminIncidentStats(),
        ]);
        if (!cancelled) {
          if (params.page > 1 && !page.items.length) {
            setPagination((previous) => ({
              ...previous,
              pageIndex: Math.max(
                0,
                Math.ceil(page.totalItems / previous.pageSize) - 1,
              ),
            }));
            return;
          }
          const at = Date.now();
          setSnapshot({ ...page, stats, at, key: JSON.stringify(params) });
          setNow(at);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        inFlight = false;
        if (!cancelled) setFetching(false);
      }
    }
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    void load();
    const timer = setInterval(onVisible, 15_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [params, refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  const stale = error || !!(snapshot && now - snapshot.at > 45_000);
  const current = snapshot?.key === key ? snapshot : null;
  const resetPage = () =>
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("ALL");
    setPeriod("ALL");
    resetPage();
  };
  const hasFilters =
    !!searchInput.trim() || status !== "ALL" || period !== "ALL";
  const statusLabels: Record<IncidentStatus, string> = {
    AWAITING_RESPONSE: t.awaiting,
    ESCALATED: t.escalated,
    RESOLVED: t.resolved,
    FALSE_ALARM: t.cancelled,
  };

  const columns = useMemo<ColumnDef<AdminIncident>[]>(
    () => [
      {
        id: "reference",
        header: t.incident,
        size: 175,
        enableSorting: false,
        cell: ({ row: { original: incident } }) => (
          <div className="flex items-center gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl ${incident.status === "ESCALATED" ? "bg-[#feedee] text-[#d92d3a]" : "bg-[#e9efff] text-[#3047d9]"}`}
            >
              <Siren className="size-5" />
            </span>
            <span className="font-mono text-[12px] font-semibold whitespace-nowrap">
              {incidentReference(incident.id)}
            </span>
          </div>
        ),
      },
      {
        id: "driver",
        accessorFn: (incident) => fullName(incident.driver),
        header: t.driver,
        size: 240,
        enableSorting: true,
        cell: ({ row: { original: incident } }) => (
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold text-primary">
              {initials(incident.driver)}
            </span>
            <div className="min-w-0 [table_&]:min-w-[145px]">
              <p className="font-medium">{fullName(incident.driver)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                {incident.driver.email}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: t.status,
        size: 185,
        enableSorting: true,
        cell: ({ row: { original: incident } }) => (
          <div className="min-w-0 space-y-1.5 [table_&]:min-w-[160px]">
            <IncidentStatusBadge status={incident.status} />
            <p className="max-w-48 text-[11px] leading-relaxed text-muted-foreground">
              {t.statusHint[incident.status]}
            </p>
          </div>
        ),
      },
      {
        id: "openedAt",
        accessorKey: "openedAt",
        header: t.openedAt,
        size: 165,
        enableSorting: true,
        cell: ({ row: { original: incident } }) => (
          <div className="text-[11px] text-muted-foreground">
            <p>{format.dateTime(incident.openedAt)}</p>
            <p className="mt-1">{format.ago(incident.openedAt)}</p>
          </div>
        ),
      },
      {
        id: "respondBy",
        accessorKey: "respondBy",
        header: t.deadline,
        size: 150,
        enableSorting: true,
        cell: ({ row: { original: incident } }) => (
          <span className="text-[11px] text-muted-foreground">
            {format.dateTime(incident.respondBy, "—")}
          </span>
        ),
      },
      {
        id: "activity",
        header: t.activity,
        size: 190,
        enableSorting: false,
        cell: ({ row: { original: incident } }) => (
          <div className="min-w-0 space-y-1.5 text-[11px] text-muted-foreground">
            <p className="flex items-center gap-2">
              <Layers3 className="size-3.5 shrink-0" />
              {t.events(format.number(incident.eventCount))}
            </p>
            <p className="flex items-center gap-2">
              <BellRing className="size-3.5 shrink-0" />
              {t.attempts(format.number(incident.notificationCount))}
            </p>
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t.details}</span>,
        size: 48,
        enableSorting: false,
        cell: ({ row: { original: incident } }) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.viewDetails(incidentReference(incident.id))}
            onClick={() => setDetailId(incident.id)}
          >
            <ArrowUpRight className="size-4" />
          </Button>
        ),
      },
    ],
    [t, format],
  );

  return (
    <motion.div
      variants={stagger(0.08)}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <motion.div variants={headerMotion.drivers.title} className="min-w-0">
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.035em] text-foreground">
            {t.title}
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">
            {t.subtitle}
          </p>
        </motion.div>
        <motion.div
          variants={headerMotion.drivers.actions}
          className="shrink-0"
        >
          <LiveRefresh
            fetching={fetching}
            stale={stale}
            updatedAt={snapshot?.at ?? null}
            onRefresh={() => setRefresh((value) => value + 1)}
            labels={{
              autoRefresh: t.autoRefresh,
              updated: t.updated,
              waiting: t.waitingData,
              refresh: t.refresh,
              refreshing: t.refreshing,
            }}
          />
        </motion.div>
      </div>
      <IncidentStats
        stats={snapshot && !stale ? snapshot.stats : null}
        loading={!snapshot && fetching}
      />
      {stale && (
        <div
          role="alert"
          className="rounded-xl border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning-strong"
        >
          {t.error}
        </div>
      )}
      <motion.div variants={sectionMotion}>
        <DataTable
          columns={columns}
          data={current?.items ?? []}
          rowCount={current?.totalItems ?? 0}
          getRowId={(incident) => incident.id}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={sorting}
          onSortingChange={(updater) => {
            setSorting(updater);
            resetPage();
          }}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          loading={!current && fetching}
          rowVariants={rowMotion.sweep}
          cardFullWidthColumns={["driver", "status", "activity"]}
          activeRowId={detailId}
          onRowClick={(incident) => setDetailId(incident.id)}
          toolbar={
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-0 basis-full sm:min-w-[240px] sm:flex-1 sm:basis-auto">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  maxLength={128}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={t.search}
                  aria-label={t.searchLabel}
                  className="h-11 rounded-[9px] bg-card pl-11"
                />
              </div>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as IncidentStatus | "ALL");
                  resetPage();
                }}
              >
                <SelectTrigger
                  aria-label={t.statusFilter}
                  className="h-11 w-full rounded-[9px] sm:w-[195px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.allStatuses}</SelectItem>
                  {INCIDENT_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {statusLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={period}
                onValueChange={(value) => {
                  setPeriod(value as IncidentPeriod | "ALL");
                  resetPage();
                }}
              >
                <SelectTrigger
                  aria-label={t.periodFilter}
                  className="h-11 w-full rounded-[9px] sm:w-[170px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.allPeriods}</SelectItem>
                  <SelectItem value="24h">{t.last24h}</SelectItem>
                  <SelectItem value="7d">{t.last7d}</SelectItem>
                  <SelectItem value="30d">{t.last30d}</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="h-11 gap-1.5 text-muted-foreground"
                >
                  <X className="size-4" />
                  {t.clear}
                </Button>
              )}
              <span className="ml-auto text-[12px] text-muted-foreground tabular-nums">
                {current
                  ? t.resultCount(format.number(current.totalItems))
                  : "—"}
              </span>
            </div>
          }
          emptyState={
            <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
              <span className="mb-2 grid size-12 place-items-center rounded-xl bg-secondary">
                <Siren className="size-6 text-primary" />
              </span>
              <h3 className="text-sm font-semibold">
                {!current && error
                  ? t.loadError
                  : hasFilters
                    ? t.noResults
                    : t.empty}
              </h3>
              <p className="max-w-sm text-[13px] text-muted-foreground">
                {!current && error
                  ? t.error
                  : hasFilters
                    ? t.noResultsHint
                    : t.emptyHint}
              </p>
              {hasFilters && (
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={clearFilters}
                >
                  {t.clear}
                </Button>
              )}
            </div>
          }
        />
      </motion.div>
      <motion.p
        variants={sectionMotion}
        className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground"
      >
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          {t.replay} {t.scope}
        </span>
      </motion.p>
      <IncidentSheet id={detailId} onClose={() => setDetailId(null)} />
    </motion.div>
  );
}
