"use client";

import {
  Activity,
  CircleX,
  Fingerprint,
  ListChecks,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { AdminAuditStats } from "../../../../lib/api/admin-audit";
import {
  useFormatters,
  useMessages,
} from "../../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../../lib/i18n/messages";

const messages = defineMessages({
  en: {
    label: "Audit statistics",
    loading: "Loading…",
    total: "Total events",
    totalHint: "Immutable log entries",
    day: "Last 24 hours",
    dayHint: "Recent activity",
    security: "Security events",
    securityHint: "MFA and token activity",
    failures: "Failed actions",
    failuresHint: "Requires review",
    actors: "Known actors",
    actorsHint: "Identified user accounts",
  },
  fr: {
    label: "Statistiques d’audit",
    loading: "Chargement…",
    total: "Événements",
    totalHint: "Entrées immuables",
    day: "Dernières 24 h",
    dayHint: "Activité récente",
    security: "Sécurité",
    securityHint: "MFA et jetons",
    failures: "Échecs",
    failuresHint: "À examiner",
    actors: "Acteurs connus",
    actorsHint: "Comptes identifiés",
  },
});

type Tone = "blue" | "green" | "purple" | "amber" | "red";

const toneClasses: Record<Tone, string> = {
  blue: "bg-[#e9efff] text-[#3047d9]",
  green: "bg-[#eaf8f0] text-[#159455]",
  purple: "bg-[#f2eaff] text-[#7f3ce5]",
  amber: "bg-[#fff4dc] text-[#c17608]",
  red: "bg-[#feedee] text-[#d92d3a]",
};

export function AuditStats({ stats }: { stats: AdminAuditStats | null }) {
  const t = useMessages(messages);
  const format = useFormatters();
  const cards: Array<{
    key: string;
    label: string;
    value: number;
    detail: string;
    icon: LucideIcon;
    tone: Tone;
  }> = [
    {
      key: "total",
      label: t.total,
      value: stats?.total ?? 0,
      detail: t.totalHint,
      icon: ListChecks,
      tone: "blue",
    },
    {
      key: "day",
      label: t.day,
      value: stats?.last24Hours ?? 0,
      detail: t.dayHint,
      icon: Activity,
      tone: "purple",
    },
    {
      key: "security",
      label: t.security,
      value: stats?.securityEvents ?? 0,
      detail: t.securityHint,
      icon: ShieldCheck,
      tone: "green",
    },
    {
      key: "failures",
      label: t.failures,
      value: stats?.failures ?? 0,
      detail: t.failuresHint,
      icon: CircleX,
      tone: "red",
    },
    {
      key: "actors",
      label: t.actors,
      value: stats?.uniqueActors ?? 0,
      detail: t.actorsHint,
      icon: Fingerprint,
      tone: "amber",
    },
  ];

  return (
    <section
      aria-label={t.label}
      aria-busy={stats === null}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5"
    >
      {cards.map(({ key, label, value, detail, icon: Icon, tone }) => (
        <article
          key={key}
          className={`flex min-h-[112px] items-start gap-4 rounded-xl border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,.02),0_4px_12px_rgba(16,24,40,.025)] ${key === "total" ? "border-[#ccd9fb]" : "border-border"}`}
        >
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-xl ${toneClasses[tone]}`}
          >
            <Icon className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="truncate text-[12px] text-[#526180]">{label}</p>
            <p className="mt-0.5 text-[24px] font-bold leading-none tracking-[-0.03em] text-foreground tabular-nums">
              {stats === null ? "—" : format.number(value)}
            </p>
            <p className="mt-2 truncate text-[11px] text-muted-foreground">
              {stats === null ? t.loading : detail}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
