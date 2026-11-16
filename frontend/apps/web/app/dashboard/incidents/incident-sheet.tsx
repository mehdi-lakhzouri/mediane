"use client";

import { useEffect, useState } from "react";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Hash,
  Layers3,
  ListOrdered,
  Mail,
  RefreshCw,
  ShieldAlert,
  Siren,
  Timer,
  UserRound,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  getAdminIncident,
  incidentReference,
  type AdminIncidentDetail,
} from "../../../lib/api/admin-incidents";
import { useFormatters, useMessages } from "../../../lib/i18n/locale-provider";
import {
  DetailRow,
  DetailSection,
  DetailSheet,
  SheetSummary,
  SummaryVisual,
} from "../../components/dashboard/detail-sheet";
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
  const reload = () => setRefresh((value) => value + 1);

  return (
    <DetailSheet
      open={!!id}
      onClose={onClose}
      title={t.details}
      subtitle={t.detailHint}
      loading={!!current?.loading && !!incident}
    >
      {current?.error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-warning/30 bg-warning-surface p-3 text-xs text-warning-strong"
        >
          {t.detailError}
        </p>
      )}
      {!incident ? (
        current?.error ? (
          <Button variant="outline" onClick={reload}>
            <RefreshCw className="size-4" />
            {t.refresh}
          </Button>
        ) : (
          <div role="status" aria-label={t.refreshing} className="space-y-4">
            <Skeleton className="h-32 w-full rounded-[12px]" />
            <Skeleton className="h-48 w-full rounded-[12px]" />
            <Skeleton className="h-48 w-full rounded-[12px]" />
          </div>
        )
      ) : (
        <>
          <SheetSummary
            visual={<SummaryVisual icon={Siren} tone="danger" />}
            title={fullName(incident.driver)}
            subtitle={incident.driver.email}
            badges={
              <>
                <IncidentStatusBadge status={incident.status} />
                <Badge variant="outline" className="font-mono text-[11px]">
                  {incidentReference(incident.id)}
                </Badge>
              </>
            }
            actions={
              <Button
                variant="outline"
                disabled={current?.loading}
                onClick={reload}
                className="h-11 flex-1 rounded-[9px] border-[#d8e1ee] bg-white"
              >
                <RefreshCw
                  className={`size-4 ${current?.loading ? "animate-spin" : ""}`}
                />
                {t.refresh}
              </Button>
            }
          />

          <DetailSection icon={ShieldAlert} title={t.identity}>
            <DetailRow
              icon={UserRound}
              label={t.driver}
              value={fullName(incident.driver)}
            />
            <DetailRow
              icon={ShieldAlert}
              label={t.status}
              value={<IncidentStatusBadge status={incident.status} />}
            />
            <DetailRow
              icon={Layers3}
              label={t.linkedEvents}
              value={format.number(incident.eventCount)}
            />
            <DetailRow
              icon={BellRing}
              label={t.notificationCount}
              value={format.number(incident.notificationCount)}
            />
            <DetailRow
              icon={Fingerprint}
              label={t.incidentId}
              value={
                <span className="font-mono text-[11px] break-all">
                  {incident.id}
                </span>
              }
            />
          </DetailSection>

          <DetailSection icon={Timer} title={t.response}>
            <DetailRow
              icon={CalendarClock}
              label={t.openedAt}
              value={date(incident.openedAt)}
            />
            <DetailRow
              icon={Timer}
              label={t.deadline}
              value={date(incident.respondBy)}
            />
            <DetailRow
              icon={CheckCircle2}
              label={t.acknowledged}
              value={date(incident.acknowledgedAt)}
              hint={
                incident.acknowledgedVia
                  ? `${t.acknowledgedVia} · ${channels[incident.acknowledgedVia] ?? t.unknown}`
                  : undefined
              }
            />
            <DetailRow
              icon={BellRing}
              label={t.escalatedAt}
              value={date(incident.escalatedAt)}
            />
            <DetailRow
              icon={CheckCircle2}
              label={t.resolvedAt}
              value={date(incident.resolvedAt)}
              hint={
                incident.resolvedVia
                  ? `${t.resolvedVia} · ${channels[incident.resolvedVia] ?? t.unknown}`
                  : undefined
              }
            />
          </DetailSection>

          <DetailSection icon={ListOrdered} title={t.timeline} list={false}>
            {incident.timeline.length ? (
              <ol>
                {incident.timeline.map((entry) => (
                  <li
                    key={entry.id}
                    className="relative ml-2 border-l border-[#dce4f0] pb-5 pl-6 last:border-0 last:pb-0"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute top-1 -left-1.5 size-3 rounded-full border-2 border-white ${entry.kind === "ESCALATED" ? "bg-danger" : entry.kind === "RESOLVED" ? "bg-success" : "bg-primary"}`}
                    />
                    <p className="text-[14px] font-medium text-[#172554]">
                      {timelineLabels[entry.kind] ?? t.unknown}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Clock3 className="size-3.5" />
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
          </DetailSection>

          <DetailSection icon={Mail} title={t.notifications} list={false}>
            {incident.notifications.length ? (
              <ul className="divide-y divide-[#dce4f0]">
                {incident.notifications.map((attempt) => (
                  <li
                    key={attempt.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="inline-flex items-center gap-2 text-[14px] font-medium text-[#172554]">
                        <Hash className="size-4 text-[#2947e8]" />
                        {attempt.kind === "ALL_CLEAR" ? t.allClear : t.alert}
                        <span className="font-normal text-muted-foreground">
                          · {channels[attempt.channel] ?? t.unknown}
                        </span>
                      </p>
                      <p className="mt-0.5 pl-6 text-[12px] text-muted-foreground">
                        {date(attempt.attemptedAt)}
                      </p>
                    </div>
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
          </DetailSection>
        </>
      )}
    </DetailSheet>
  );
}
