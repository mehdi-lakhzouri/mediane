"use client";

import {
  Clock3,
  Copy,
  Fingerprint,
  Globe2,
  LockKeyhole,
  MonitorSmartphone,
  ScanSearch,
  UserRound,
} from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import type {
  AdminAuditEntry,
  AuditJson,
} from "../../../../lib/api/admin-audit";
import {
  useFormatters,
  useMessages,
} from "../../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../../lib/i18n/messages";
import { auditActionLabel, labelMessages } from "../labels";
import { useToast } from "../toast-provider";
import { fullName } from "../users/format";
import { AuditCategoryBadge, AuditOutcomeBadge } from "./audit-badges";

const messages = defineMessages({
  en: {
    title: "Audit event",
    subtitle: "Immutable request context and sanitized event metadata.",
    recordedAt: "Recorded at",
    actor: "Actor",
    target: "Target",
    noTarget: "No target",
    source: "Source address",
    notCaptured: "Not captured",
    trace: "Request trace",
    copyRequestId: "Copy request ID",
    eventId: "Event ID",
    requestId: "Request ID",
    actorType: "Actor type",
    targetId: "Target identifier",
    client: "Client context",
    userAgent: "User agent",
    metadata: "Sanitized metadata",
    noMetadata: "No metadata was recorded for this event.",
    immutable:
      "Audit entries cannot be edited or deleted. Secret-looking metadata keys are removed before an entry is stored.",
    copied: (label: string) => `${label} copied.`,
    copyFailed: (label: string) => `Could not copy ${label.toLowerCase()}.`,
    copy: (label: string) => `Copy ${label}`,
  },
  fr: {
    title: "Événement d’audit",
    subtitle:
      "Contexte de requête immuable et métadonnées d’événement assainies.",
    recordedAt: "Enregistré le",
    actor: "Acteur",
    target: "Cible",
    noTarget: "Aucune cible",
    source: "Adresse source",
    notCaptured: "Non capturée",
    trace: "Trace de la requête",
    copyRequestId: "Copier l’ID de requête",
    eventId: "ID d’événement",
    requestId: "ID de requête",
    actorType: "Type d’acteur",
    targetId: "Identifiant de la cible",
    client: "Contexte client",
    userAgent: "Agent utilisateur",
    metadata: "Métadonnées assainies",
    noMetadata: "Aucune métadonnée n’a été enregistrée pour cet événement.",
    immutable:
      "Les entrées d’audit ne peuvent être ni modifiées ni supprimées. Les clés de métadonnées ressemblant à des secrets sont retirées avant l’enregistrement.",
    copied: (label: string) => `${label} copié.`,
    copyFailed: (label: string) => `Impossible de copier : ${label}.`,
    copy: (label: string) => `Copier : ${label}`,
  },
});

export function AuditSheet({
  entry,
  open,
  onOpenChange,
}: {
  entry: AdminAuditEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const t = useMessages(messages);
  const labels = useMessages(labelMessages);
  const format = useFormatters();
  if (!entry) return null;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t.copied(label));
    } catch {
      toast.error(t.copyFailed(label));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        overlayClassName="bg-[#101828]/28 backdrop-blur-[8px] backdrop-saturate-75"
        closeClassName="top-6 right-6 z-20 text-[#39507f] opacity-100 hover:bg-[#eef3ff] [&_svg]:size-5"
        className="w-full bg-white shadow-[-18px_0_60px_rgba(16,24,40,.18)] sm:max-w-[640px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="sticky top-0 z-10 gap-1 border-0 bg-white/95 px-7 pt-7 pb-5 pr-16 backdrop-blur-xl">
          <SheetTitle className="text-[26px] leading-8 tracking-[-0.035em]">
            {t.title}
          </SheetTitle>
          <p className="text-[14px] leading-5 text-[#536489]">{t.subtitle}</p>
        </SheetHeader>

        <SheetBody className="px-7 pt-0 pb-7">
          <section className="rounded-[12px] border border-[#d7e1f2] bg-[#f8faff] px-5 py-5">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#e7edff] text-primary">
                <ScanSearch className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {entry.action}
                </p>
                <h2 className="mt-1 text-[22px] font-bold tracking-[-0.025em] text-foreground">
                  {auditActionLabel(labels, entry.action)}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AuditCategoryBadge category={entry.category} />
                  <AuditOutcomeBadge outcome={entry.outcome} />
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoCard
              icon={Clock3}
              label={t.recordedAt}
              value={format.dateTime(entry.createdAt)}
            />
            <InfoCard
              icon={UserRound}
              label={t.actor}
              value={
                entry.actor
                  ? fullName(entry.actor)
                  : labels.actorType[entry.actorType]
              }
              detail={entry.actor?.email ?? entry.actorUserId ?? undefined}
            />
            <InfoCard
              icon={Fingerprint}
              label={t.target}
              value={
                entry.targetType
                  ? labels.targetType[entry.targetType]
                  : t.noTarget
              }
              detail={entry.targetId ?? undefined}
            />
            <InfoCard
              icon={Globe2}
              label={t.source}
              value={entry.ipAddress ?? t.notCaptured}
            />
          </section>

          <section className="mt-7">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[16px] font-semibold text-foreground">
                {t.trace}
              </h3>
              {entry.requestId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void copy(entry.requestId!, t.requestId)}
                  className="text-primary"
                >
                  <Copy /> {t.copyRequestId}
                </Button>
              ) : null}
            </div>
            <div className="mt-3 divide-y divide-[#e6ecf6] rounded-[12px] border border-[#e1e8f4]">
              <TraceRow
                label={t.eventId}
                value={entry.id}
                copyLabel={t.copy(t.eventId)}
                onCopy={() => void copy(entry.id, t.eventId)}
              />
              <TraceRow label={t.requestId} value={entry.requestId ?? "—"} />
              <TraceRow label={t.actorType} value={entry.actorType} />
              <TraceRow label={t.targetId} value={entry.targetId ?? "—"} />
            </div>
          </section>

          <section className="mt-7">
            <h3 className="text-[16px] font-semibold text-foreground">
              {t.client}
            </h3>
            <div className="mt-3 rounded-[12px] border border-[#e1e8f4] px-4 py-4">
              <p className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                <MonitorSmartphone className="size-4 text-primary" />{" "}
                {t.userAgent}
              </p>
              <p className="mt-2 break-words font-mono text-[11px] leading-5 text-muted-foreground">
                {entry.userAgent ?? t.notCaptured}
              </p>
            </div>
          </section>

          <section className="mt-7">
            <h3 className="text-[16px] font-semibold text-foreground">
              {t.metadata}
            </h3>
            {entry.metadata && Object.keys(entry.metadata).length ? (
              <dl className="mt-3 divide-y divide-[#e6ecf6] overflow-hidden rounded-[12px] border border-[#e1e8f4]">
                {Object.entries(entry.metadata).map(([key, value]) => (
                  <div
                    key={key}
                    className="grid gap-1 px-4 py-3 sm:grid-cols-[170px_1fr] sm:gap-4"
                  >
                    <dt className="font-mono text-[11px] font-semibold text-[#526180]">
                      {key}
                    </dt>
                    <dd className="break-words font-mono text-[11px] leading-5 text-foreground">
                      {formatMetadataValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 rounded-[12px] border border-dashed border-[#d7e1f2] px-4 py-5 text-center text-[12px] text-muted-foreground">
                {t.noMetadata}
              </p>
            )}
          </section>

          <p className="mt-7 flex items-start gap-3 rounded-[12px] border border-[#d7e1f2] bg-[#f8faff] px-4 py-4 text-[12px] leading-5 text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" />
            {t.immutable}
          </p>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="min-w-0 rounded-[10px] border border-[#e1e8f4] px-3.5 py-3">
      <p className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <Icon className="size-3.5 text-primary" /> {label}
      </p>
      <p className="mt-1.5 truncate text-[12px] font-semibold text-foreground">
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
          {detail}
        </p>
      ) : null}
    </article>
  );
}

function TraceRow({
  label,
  value,
  onCopy,
  copyLabel,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copyLabel?: string;
}) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <code className="truncate text-[11px] text-foreground">{value}</code>
      {onCopy ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={copyLabel}
          onClick={onCopy}
        >
          <Copy />
        </Button>
      ) : null}
    </div>
  );
}

function formatMetadataValue(value: AuditJson): string {
  if (typeof value === "string") return value;
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
