"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BellRing, RefreshCw, Siren } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import {
  getAdminIncident,
  incidentReference,
  type AdminIncidentDetail,
} from "../../../lib/api/admin-incidents";
import { useFormatters, useMessages } from "../../../lib/i18n/locale-provider";
import { fullName } from "../../components/dashboard/users/format";
import { IncidentStatusBadge } from "./incident-badges";
import { incidentMessages } from "./incidents.messages";

export function IncidentSheet({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const t = useMessages(incidentMessages);
  const format = useFormatters();
  const [refresh, setRefresh] = useState(0);
  const [view, setView] = useState<{
    id: string;
    data: AdminIncidentDetail | null;
    error: boolean;
    loading: boolean;
  } | null>(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false,
      inFlight = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      setView((previous) => ({
        id: id!,
        data: previous?.id === id ? previous.data : null,
        error: false,
        loading: true,
      }));
      try {
        const data = await getAdminIncident(id!);
        if (!cancelled)
          setView({ id: id!, data, error: false, loading: false });
      } catch {
        if (!cancelled)
          setView((previous) => ({
            id: id!,
            data: previous?.id === id ? previous.data : null,
            error: true,
            loading: false,
          }));
      } finally {
        inFlight = false;
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
  }, [id, refresh]);
  const current = view?.id === id ? view : null;
  const incident = current?.data;
  const channels: Record<string, string> = t.channelLabels;
  const timelineLabels: Record<string, string> = t.timelineLabels;
  const date = (value: string | null) =>
    format.dateTime(
      value && Number.isFinite(Date.parse(value)) ? value : null,
      "—",
    );
  return (
    <Sheet
      open={!!id}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle>{t.details}</SheetTitle>
          <SheetDescription>{t.detailHint}</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-6">
          {current?.error && (
            <p
              role="alert"
              className="rounded-xl border border-warning/30 bg-warning-surface p-3 text-xs text-warning-strong"
            >
              {t.detailError}
            </p>
          )}
          {!incident ? (
            current?.error ? (
              <Button
                variant="outline"
                onClick={() => setRefresh((value) => value + 1)}
              >
                <RefreshCw className="size-4" />
                {t.refresh}
              </Button>
            ) : (
              <div
                role="status"
                aria-label={t.refreshing}
                className="space-y-4"
              >
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            )
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#feedee] text-[#d92d3a]">
                  <Siren className="size-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold">
                    {incidentReference(incident.id)}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {date(incident.openedAt)}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={current?.loading}
                  aria-label={t.refresh}
                  className="ml-auto"
                  onClick={() => setRefresh((value) => value + 1)}
                >
                  <RefreshCw
                    className={`size-4 ${current?.loading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
              <DetailSection title={t.identity}>
                <DetailField label={t.driver}>
                  <span className="block font-semibold">
                    {fullName(incident.driver)}
                  </span>
                  <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {incident.driver.email}
                  </span>
                </DetailField>
                <DetailField label={t.status}>
                  <IncidentStatusBadge status={incident.status} />
                </DetailField>
                <DetailField label={t.incidentId}>
                  <span className="break-all font-mono text-[11px]">
                    {incident.id}
                  </span>
                </DetailField>
                <DetailField label={t.linkedEvents}>
                  {format.number(incident.eventCount)}
                </DetailField>
                <DetailField label={t.notificationCount}>
                  {format.number(incident.notificationCount)}
                </DetailField>
              </DetailSection>
              <DetailSection title={t.response}>
                <DetailField label={t.openedAt}>
                  {date(incident.openedAt)}
                </DetailField>
                <DetailField label={t.deadline}>
                  {date(incident.respondBy)}
                </DetailField>
                <DetailField label={t.acknowledged}>
                  {date(incident.acknowledgedAt)}
                </DetailField>
                <DetailField label={t.acknowledgedVia}>
                  {channels[incident.acknowledgedVia ?? ""] ?? "—"}
                </DetailField>
                <DetailField label={t.escalatedAt}>
                  {date(incident.escalatedAt)}
                </DetailField>
                <DetailField label={t.resolvedAt}>
                  {date(incident.resolvedAt)}
                </DetailField>
                <DetailField label={t.resolvedVia}>
                  {channels[incident.resolvedVia ?? ""] ?? "—"}
                </DetailField>
              </DetailSection>
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.timeline}
                </h3>
                {incident.timeline.length ? (
                  <ol className="space-y-0">
                    {incident.timeline.map((entry) => (
                      <li
                        key={entry.id}
                        className="relative ml-2 border-l border-border pb-5 pl-6 last:border-0 last:pb-0"
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute top-1 -left-1.5 size-3 rounded-full border-2 border-card ${entry.kind === "ESCALATED" ? "bg-danger" : entry.kind === "RESOLVED" ? "bg-success" : "bg-primary"}`}
                        />
                        <p className="text-[13px] font-medium">
                          {timelineLabels[entry.kind] ?? t.unknown}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {date(entry.at)}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
                    {t.noTimeline}
                  </p>
                )}
              </section>
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.notifications}
                </h3>
                {incident.notifications.length ? (
                  <ul className="space-y-2">
                    {incident.notifications.map((attempt) => (
                      <li
                        key={attempt.id}
                        className="rounded-xl border border-border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2 text-[13px] font-medium">
                            <BellRing className="size-4 text-muted-foreground" />
                            {attempt.kind === "ALL_CLEAR"
                              ? t.allClear
                              : t.alert}{" "}
                            · {channels[attempt.channel] ?? t.unknown}
                          </span>
                          <Badge
                            variant={
                              attempt.status === "FAILED"
                                ? "danger"
                                : attempt.status === "SKIPPED" ||
                                    attempt.channel === "LOG"
                                  ? "outline"
                                  : "success"
                            }
                            className="text-[10px]"
                          >
                            {attempt.status === "FAILED"
                              ? t.failed
                              : attempt.status === "SKIPPED"
                                ? t.skipped
                                : attempt.channel === "LOG"
                                  ? t.recorded
                                  : t.accepted}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {date(attempt.attemptedAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
                    {t.noNotifications}
                  </p>
                )}
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {t.notificationHint}
                </p>
              </section>
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
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
      <dl className="divide-y divide-border rounded-xl border border-border bg-card px-4">
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
    <div className="grid grid-cols-[125px_minmax(0,1fr)] gap-3 py-3 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
