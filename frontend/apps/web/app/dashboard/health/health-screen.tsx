"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  listAdminDevices,
  type AdminDevice,
} from "../../../lib/api/admin-devices";
import { defineMessages } from "../../../lib/i18n/messages";
import { useFormatters, useMessages } from "../../../lib/i18n/locale-provider";

const messages = defineMessages({
  en: {
    title: "Monitoring coverage",
    subtitle:
      "Device connectivity and detector availability across your fleet.",
    privacy:
      "Operational status only. Readiness does not indicate that a driver is medically safe.",
    device: "Device",
    driver: "Driver",
    mode: "Mode",
    coverage: "Coverage",
    cardiac: "Cardiac",
    seizure: "Seizure",
    stroke: "Stroke",
    queue: "Pending",
    lastSeen: "Last heartbeat",
    refresh: "Refresh",
    loading: "Loading devices…",
    empty: "No devices registered yet",
    emptyHint: "Register and pair a cabin unit to see its monitoring status.",
    error: "Monitoring could not be refreshed. Displayed data may be outdated.",
    previous: "Previous",
    next: "Next",
    unpaired: "Unpaired",
    page: "Page",
    total: "devices",
    updated: "Updated",
    shadow: "Shadow",
    active: "Active",
    unavailable: "Unavailable",
    ready: "Ready",
    warming: "Warming up",
    degraded: "Limited",
    failed: "Error",
  },
  fr: {
    title: "Couverture de surveillance",
    subtitle:
      "Connexion des boîtiers et disponibilité des détecteurs de votre flotte.",
    privacy:
      "État opérationnel uniquement. La disponibilité ne confirme pas la bonne santé du conducteur.",
    device: "Boîtier",
    driver: "Conducteur",
    mode: "Mode",
    coverage: "Couverture",
    cardiac: "Cardiaque",
    seizure: "Crises",
    stroke: "AVC",
    queue: "En attente",
    lastSeen: "Dernier signal",
    refresh: "Actualiser",
    loading: "Chargement des boîtiers…",
    empty: "Aucun boîtier enregistré",
    emptyHint:
      "Enregistrez et associez un boîtier pour afficher son état de surveillance.",
    error:
      "La surveillance n’a pas pu être actualisée. Les données affichées peuvent être anciennes.",
    previous: "Précédent",
    next: "Suivant",
    unpaired: "Non associé",
    page: "Page",
    total: "boîtiers",
    updated: "Actualisé",
    shadow: "Observation",
    active: "Actif",
    unavailable: "Indisponible",
    ready: "Disponible",
    warming: "Initialisation",
    degraded: "Limitée",
    failed: "Erreur",
  },
});

function runtimeState(device: AdminDevice, now: number) {
  if (
    device.status !== "ACTIVE" ||
    !device.pairedUserId ||
    !device.lastSeenAt ||
    now - Date.parse(device.lastSeenAt) > 120000 ||
    !device.runtimeHealth
  )
    return "UNAVAILABLE";
  const values = [
    device.runtimeHealth.cardiac,
    device.runtimeHealth.seizure,
    device.runtimeHealth.stroke,
  ];
  return values.every((v) => v === "READY")
    ? "READY"
    : values.some((v) => ["ERROR", "DEGRADED", "UNAVAILABLE"].includes(v))
      ? "DEGRADED"
      : "WARMING_UP";
}

export function HealthScreen() {
  const t = useMessages(messages);
  const { dateTime } = useFormatters();
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    items: AdminDevice[];
    total: number;
    at: number;
    page: number;
  } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await listAdminDevices({ page, pageSize: 10 });
        if (!cancelled) {
          setSnapshot({
            items: result.items,
            total: result.totalItems,
            at: Date.now(),
            page,
          });
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        inFlight = false;
      }
    }
    void load();
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    const timer = setInterval(onVisible, 15000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [page, refresh]);

  const labels: Record<string, string> = {
    READY: t.ready,
    WARMING_UP: t.warming,
    DEGRADED: t.degraded,
    UNAVAILABLE: t.unavailable,
    ERROR: t.failed,
  };
  const current = snapshot?.page === page ? snapshot : null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Activity className="size-6 text-primary" />
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button variant="outline" onClick={() => setRefresh((n) => n + 1)}>
          <RefreshCw className="size-4" />
          {t.refresh}
        </Button>
      </div>
      <p className="rounded-xl border bg-secondary/30 p-4 text-sm text-muted-foreground">
        {t.privacy}
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
        >
          {t.error}
        </p>
      )}
      {!current ? (
        <p role="status">{error ? t.error : t.loading}</p>
      ) : current.items.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="font-semibold">{t.empty}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.emptyHint}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t.title}</caption>
              <thead className="border-b bg-secondary/40 text-muted-foreground">
                <tr>
                  {[
                    t.device,
                    t.driver,
                    t.mode,
                    t.coverage,
                    t.cardiac,
                    t.seizure,
                    t.stroke,
                    t.queue,
                    t.lastSeen,
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 font-medium"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {current.items.map((device) => {
                  const state = error
                    ? "UNAVAILABLE"
                    : runtimeState(device, current.at);
                  const valid = state !== "UNAVAILABLE";
                  return (
                    <tr key={device.id}>
                      <th scope="row" className="px-4 py-4 font-medium">
                        <span className="block">{device.label}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {device.serialNumber}
                        </span>
                      </th>
                      <td className="px-4 py-4">
                        {device.pairedDriver
                          ? `${device.pairedDriver.firstName} ${device.pairedDriver.lastName}`
                          : t.unpaired}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="secondary">
                          {device.aiMode === "ACTIVE" ? t.active : t.shadow}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant={state === "READY" ? "default" : "outline"}
                        >
                          {labels[state]}
                        </Badge>
                      </td>
                      {(["cardiac", "seizure", "stroke"] as const).map(
                        (key) => (
                          <td key={key} className="px-4 py-4">
                            {labels[
                              valid
                                ? (device.runtimeHealth?.[key] ?? "UNAVAILABLE")
                                : "UNAVAILABLE"
                            ] ?? t.unavailable}
                          </td>
                        ),
                      )}
                      <td className="px-4 py-4">
                        {valid
                          ? (device.runtimeHealth?.queueDepth ?? "—")
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                        {dateTime(device.lastSeenAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
            <span aria-live="polite">
              {t.page} {page} · {current.total} {t.total} · {t.updated}{" "}
              {dateTime(new Date(current.at))}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((n) => n - 1)}
              >
                {t.previous}
              </Button>
              <Button
                variant="outline"
                disabled={page * 10 >= current.total}
                onClick={() => setPage((n) => n + 1)}
              >
                {t.next}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
