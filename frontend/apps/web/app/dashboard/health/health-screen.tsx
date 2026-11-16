"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import type {
  ColumnDef,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpRight,
  Clock3,
  Cpu,
  Info,
  RefreshCw,
  Search,
  Server,
  UserRound,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { DataTable } from "../../components/data-table/data-table";
import {
  ctaMotion,
  headerMotion,
  rowMotion,
  sectionMotion,
  stagger,
} from "../../components/dashboard/motion";
import { fullName, initials } from "../../components/dashboard/users/format";
import {
  listAllAdminDevices,
  type AdminDevice,
} from "../../../lib/api/admin-devices";
import { useFormatters, useMessages } from "../../../lib/i18n/locale-provider";
import { healthMessages } from "./health-screen.messages";
import { DETECTORS, deviceHealth, type DetectorState } from "./health-status";
import { HealthStats } from "./health-stats";

type CoverageFilter =
  | "ALL"
  | "ONLINE"
  | "OFFLINE"
  | "ATTENTION"
  | "READY"
  | "WARMING_UP"
  | "DEGRADED";
const priority: Record<DetectorState, number> = {
  UNAVAILABLE: 0,
  ERROR: 1,
  DEGRADED: 2,
  WARMING_UP: 3,
  READY: 4,
};

function StatusBadge({ state }: { state: DetectorState }) {
  const t = useMessages(healthMessages);
  const labels = {
    READY: t.ready,
    WARMING_UP: t.warming,
    DEGRADED: t.degraded,
    ERROR: t.failed,
    UNAVAILABLE: t.unavailable,
  };
  return (
    <Badge
      variant={
        state === "READY"
          ? "success"
          : state === "ERROR"
            ? "danger"
            : state === "UNAVAILABLE"
              ? "outline"
              : "warning"
      }
      className="gap-1.5 text-[11px]"
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      {labels[state]}
    </Badge>
  );
}

export function HealthScreen() {
  const t = useMessages(healthMessages);
  const format = useFormatters();
  const [snapshot, setSnapshot] = useState<{
    items: AdminDevice[];
    at: number;
  } | null>(null);
  const [error, setError] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(0);
  const [search, setSearch] = useState("");
  const [coverage, setCoverage] = useState<CoverageFilter>("ALL");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "device", desc: false },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      setFetching(true);
      try {
        const items = await listAllAdminDevices();
        if (!cancelled) {
          const at = Date.now();
          setSnapshot({ items, at });
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
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  const stale = error || !!(snapshot && now - snapshot.at > 45_000);
  const devices = useMemo(() => snapshot?.items ?? [], [snapshot]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const matches = devices.filter((device) => {
      const health = deviceHealth(device, now, stale);
      const haystack = [
        device.label,
        device.serialNumber,
        device.pairedDriver ? fullName(device.pairedDriver) : "",
        device.pairedDriver?.email ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!query || haystack.includes(query)) &&
        (coverage === "ALL" ||
          (coverage === "ONLINE"
            ? health.online
            : coverage === "OFFLINE"
              ? !health.online
              : coverage === "ATTENTION"
                ? health.state !== "READY"
                : health.state === coverage))
      );
    });
    const sort = sorting[0];
    const value = (device: AdminDevice): string | number => {
      const health = deviceHealth(device, now, stale);
      switch (sort?.id) {
        case "driver":
          return device.pairedDriver ? fullName(device.pairedDriver) : "";
        case "coverage":
          return priority[health.state];
        case "queue":
          return health.queue ?? -1;
        case "lastSeen":
          return Date.parse(device.lastSeenAt ?? "") || 0;
        default:
          return device.label;
      }
    };
    return matches.sort((a, b) => {
      const left = value(a),
        right = value(b);
      const result =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), undefined, {
              numeric: true,
              sensitivity: "base",
            });
      return (
        (result || a.serialNumber.localeCompare(b.serialNumber)) *
        (sort?.desc ? -1 : 1)
      );
    });
  }, [devices, now, stale, search, coverage, sorting]);

  const maxPage = Math.max(
    0,
    Math.ceil(filtered.length / pagination.pageSize) - 1,
  );
  const currentPagination = {
    ...pagination,
    pageIndex: Math.min(pagination.pageIndex, maxPage),
  };
  const visible = filtered.slice(
    currentPagination.pageIndex * currentPagination.pageSize,
    (currentPagination.pageIndex + 1) * currentPagination.pageSize,
  );
  const selected = devices.find((device) => device.id === detailId) ?? null;
  const resetPage = () =>
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  const clearFilters = () => {
    setSearch("");
    setCoverage("ALL");
    resetPage();
  };
  const hasFilters = !!search.trim() || coverage !== "ALL";
  const safeDate = (date: string | null | undefined) =>
    format.dateTime(date && Number.isFinite(Date.parse(date)) ? date : null);

  const columns = useMemo<ColumnDef<AdminDevice>[]>(
    () => [
      {
        id: "device",
        accessorFn: (device) => device.label,
        header: t.device,
        size: 235,
        enableSorting: true,
        cell: ({ row: { original: device } }) => (
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e9efff] text-[#3047d9]">
              <Cpu className="size-5" />
            </span>
            <div className="min-w-[130px]">
              <p className="font-semibold text-foreground">{device.label}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {device.serialNumber}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "driver",
        accessorFn: (device) =>
          device.pairedDriver ? fullName(device.pairedDriver) : "",
        header: t.driver,
        size: 220,
        enableSorting: true,
        cell: ({ row: { original: device } }) =>
          device.pairedDriver ? (
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold text-primary">
                {initials(device.pairedDriver)}
              </span>
              <div className="min-w-[155px]">
                <p className="font-medium text-foreground">
                  {fullName(device.pairedDriver)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                  {device.pairedDriver.email}
                </p>
              </div>
            </div>
          ) : (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <UserRound className="size-4" />
              {device.pairedUserId ? t.unknown : t.unpaired}
            </span>
          ),
      },
      {
        id: "coverage",
        accessorFn: (device) =>
          priority[deviceHealth(device, now, stale).state],
        header: t.coverage,
        size: 180,
        enableSorting: true,
        cell: ({ row: { original: device } }) => {
          const health = deviceHealth(device, now, stale);
          return (
            <div className="min-w-0 space-y-1.5 [table_&]:min-w-[145px]">
              <StatusBadge state={health.state} />
              <p className="max-w-52 text-[11px] leading-relaxed text-muted-foreground">
                {t.reasons[health.reason]}
              </p>
            </div>
          );
        },
      },
      {
        id: "detectors",
        header: t.detectors,
        size: 180,
        enableSorting: false,
        cell: ({ row: { original: device } }) => {
          const health = deviceHealth(device, now, stale);
          return (
            <div className="min-w-[160px] space-y-1.5">
              {DETECTORS.map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 text-[11px]"
                >
                  <span className="text-muted-foreground">{t[key]}</span>
                  <StatusBadge state={health.detectors[key]} />
                </div>
              ))}
            </div>
          );
        },
      },
      {
        id: "queue",
        accessorFn: (device) => deviceHealth(device, now, stale).queue ?? -1,
        header: t.queue,
        size: 100,
        enableSorting: true,
        cell: ({ row: { original: device } }) => {
          const queue = deviceHealth(device, now, stale).queue;
          return (
            <span
              className={
                queue
                  ? "font-semibold text-warning-strong tabular-nums"
                  : "text-muted-foreground tabular-nums"
              }
            >
              {queue === null ? "—" : format.number(queue)}
            </span>
          );
        },
      },
      {
        id: "lastSeen",
        accessorFn: (device) => Date.parse(device.lastSeenAt ?? "") || 0,
        header: t.lastSeen,
        size: 160,
        enableSorting: true,
        cell: ({ row: { original: device } }) => {
          const valid =
            !!device.lastSeenAt &&
            Number.isFinite(Date.parse(device.lastSeenAt));
          return (
            <div className="min-w-[125px] text-[11px] text-muted-foreground">
              <p className="whitespace-nowrap">
                {format.dateTime(valid ? device.lastSeenAt : null)}
              </p>
              {valid && (
                <p className="mt-1">{format.ago(device.lastSeenAt!)}</p>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t.details}</span>,
        size: 48,
        enableSorting: false,
        cell: ({ row: { original: device } }) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.viewDetails(device.serialNumber)}
            onClick={() => setDetailId(device.id)}
          >
            <ArrowUpRight className="size-4" />
          </Button>
        ),
      },
    ],
    [t, format, now, stale],
  );

  return (
    <motion.div
      variants={stagger(0.08)}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div variants={headerMotion.drivers.title}>
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.035em] text-foreground">
            {t.title}
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">
            {t.subtitle}
          </p>
        </motion.div>
        <motion.div
          variants={headerMotion.drivers.actions}
          className="inline-flex shrink-0"
        >
          <motion.div {...ctaMotion} className="inline-flex">
            <Button
              size="lg"
              disabled={fetching}
              onClick={() => setRefresh((value) => value + 1)}
              className="h-[46px] rounded-[9px] px-6 shadow-[0_5px_14px_rgba(48,71,217,.18)]"
            >
              <RefreshCw
                className={`size-4 ${fetching ? "animate-spin" : ""}`}
              />
              {fetching ? t.refreshing : t.refresh}
            </Button>
          </motion.div>
        </motion.div>
      </div>

      <HealthStats
        devices={devices}
        now={now}
        failed={stale}
        loading={!snapshot && fetching}
        known={!!snapshot}
      />

      <motion.div
        variants={sectionMotion}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-[12px] text-muted-foreground"
      >
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${stale ? "bg-warning" : "bg-success"}`}
          />
          {t.autoRefresh}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5" />
          {snapshot
            ? `${t.updated} · ${format.dateTime(new Date(snapshot.at))}`
            : t.notUpdated}
        </span>
      </motion.div>
      {stale && (
        <div
          role="alert"
          className="rounded-xl border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning-strong"
        >
          {t.error}
        </div>
      )}

      <motion.section variants={sectionMotion} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight">
              {t.inventoryTitle}
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {t.inventoryHint}
            </p>
          </div>
          <span className="text-[12px] text-muted-foreground">
            {t.results(
              format.number(filtered.length),
              format.number(devices.length),
            )}
          </span>
        </div>
        <DataTable
          cardFullWidthColumns={["driver", "detectors", "lastSeen"]}
          columns={columns}
          data={visible}
          rowCount={filtered.length}
          getRowId={(device) => device.id}
          pagination={currentPagination}
          onPaginationChange={setPagination}
          sorting={sorting}
          onSortingChange={(updater) => {
            setSorting(updater);
            resetPage();
          }}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          loading={!snapshot && fetching}
          rowVariants={rowMotion.sweep}
          activeRowId={detailId}
          onRowClick={(device) => setDetailId(device.id)}
          toolbar={
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-0 basis-full sm:min-w-[240px] sm:flex-1 sm:basis-auto">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetPage();
                  }}
                  placeholder={t.search}
                  aria-label={t.searchLabel}
                  className="h-11 rounded-[9px] bg-card pl-11"
                />
              </div>
              <Select
                value={coverage}
                onValueChange={(value) => {
                  setCoverage(value as CoverageFilter);
                  resetPage();
                }}
              >
                <SelectTrigger
                  aria-label={t.coverageFilter}
                  className="h-11 w-full rounded-[9px] sm:w-[195px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.allCoverage}</SelectItem>
                  <SelectItem value="ONLINE">{t.onlineFilter}</SelectItem>
                  <SelectItem value="OFFLINE">{t.offlineFilter}</SelectItem>
                  <SelectItem value="ATTENTION">{t.attentionFilter}</SelectItem>
                  <SelectItem value="READY">{t.ready}</SelectItem>
                  <SelectItem value="WARMING_UP">{t.warming}</SelectItem>
                  <SelectItem value="DEGRADED">{t.degraded}</SelectItem>
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
            </div>
          }
          emptyState={
            <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
              <span className="mb-2 grid size-12 place-items-center rounded-xl bg-secondary">
                <Server className="size-6 text-primary" />
              </span>
              <h3 className="text-sm font-semibold">
                {!snapshot && error
                  ? t.loadError
                  : hasFilters
                    ? t.noResults
                    : t.empty}
              </h3>
              <p className="max-w-sm text-[13px] text-muted-foreground">
                {!snapshot && error
                  ? t.reasons.refreshFailed
                  : hasFilters
                    ? t.noResultsHint
                    : t.emptyHint}
              </p>
              {hasFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="mt-2"
                >
                  {t.clear}
                </Button>
              )}
            </div>
          }
        />
      </motion.section>
      <motion.p
        variants={sectionMotion}
        className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground"
      >
        <Info className="mt-0.5 size-4 shrink-0" />
        {t.privacy}
      </motion.p>

      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      >
        <SheetContent className="sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle>{t.details}</SheetTitle>
            <SheetDescription>{t.detailHint}</SheetDescription>
          </SheetHeader>
          {selected && (
            <SheetBody className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-xl bg-[#e9efff] text-primary">
                  <Cpu className="size-6" />
                </span>
                <div>
                  <h3 className="font-bold">{selected.label}</h3>
                  <p className="font-mono text-xs text-muted-foreground">
                    {selected.serialNumber}
                  </p>
                </div>
              </div>
              {stale && (
                <p
                  role="status"
                  className="rounded-lg bg-warning-surface p-3 text-xs text-warning-strong"
                >
                  {t.error}
                </p>
              )}
              <DetailSection title={t.assignment}>
                <DetailField label={t.driver}>
                  {selected.pairedDriver ? (
                    <>
                      <span className="block font-semibold">
                        {fullName(selected.pairedDriver)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {selected.pairedDriver.email}
                      </span>
                    </>
                  ) : selected.pairedUserId ? (
                    t.unknown
                  ) : (
                    t.unpaired
                  )}
                </DetailField>
                <DetailField label={t.pairedAt}>
                  {safeDate(selected.pairedAt)}
                </DetailField>
              </DetailSection>
              <DetailSection title={t.connection}>
                <DetailField label={t.device}>
                  <span className="inline-flex items-center gap-2">
                    {deviceHealth(selected, now, stale).online ? (
                      <Wifi className="size-4 text-success-strong" />
                    ) : (
                      <WifiOff className="size-4 text-muted-foreground" />
                    )}
                    {stale
                      ? t.unknown
                      : selected.status === "REVOKED"
                        ? t.revokedLabel
                        : deviceHealth(selected, now).online
                          ? t.onlineLabel
                          : t.offlineLabel}
                  </span>
                </DetailField>
                <DetailField label={t.coverage}>
                  <StatusBadge
                    state={deviceHealth(selected, now, stale).state}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t.reasons[deviceHealth(selected, now, stale).reason]}
                  </p>
                </DetailField>
                {DETECTORS.map((key) => (
                  <DetailField key={key} label={t[key]}>
                    <StatusBadge
                      state={deviceHealth(selected, now, stale).detectors[key]}
                    />
                  </DetailField>
                ))}
                <DetailField label={t.lastSeen}>
                  {safeDate(selected.lastSeenAt)}
                </DetailField>
                <DetailField label={t.queue}>
                  {deviceHealth(selected, now, stale).queue === null
                    ? "—"
                    : format.number(deviceHealth(selected, now, stale).queue!)}
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {t.queueHelp}
                  </p>
                </DetailField>
              </DetailSection>
              <DetailSection title={t.configuration}>
                <DetailField label={t.firmware}>
                  {selected.firmwareVersion || t.unknown}
                </DetailField>
                <DetailField label={t.runtime}>
                  {selected.runtimeHealth?.runtimeVersion || t.unknown}
                </DetailField>
                <DetailField label={t.association}>
                  <span className="break-all font-mono text-[11px]">
                    {selected.associationId || t.unknown}
                  </span>
                </DetailField>
                <DetailField label={t.createdAt}>
                  {safeDate(selected.createdAt)}
                </DetailField>
              </DetailSection>
            </SheetBody>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card px-4">
        {children}
      </dl>
    </section>
  );
}
function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
