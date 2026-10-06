import {
  Activity,
  CircleX,
  Fingerprint,
  ListChecks,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { AdminAuditStats } from "../../../../lib/api/admin-audit";

type Tone = "blue" | "green" | "purple" | "amber" | "red";

const toneClasses: Record<Tone, string> = {
  blue: "bg-[#e9efff] text-[#3047d9]",
  green: "bg-[#eaf8f0] text-[#159455]",
  purple: "bg-[#f2eaff] text-[#7f3ce5]",
  amber: "bg-[#fff4dc] text-[#c17608]",
  red: "bg-[#feedee] text-[#d92d3a]",
};

export function AuditStats({ stats }: { stats: AdminAuditStats | null }) {
  const cards: Array<{
    label: string;
    value: number;
    detail: string;
    icon: LucideIcon;
    tone: Tone;
  }> = [
    {
      label: "Total events",
      value: stats?.total ?? 0,
      detail: "Immutable log entries",
      icon: ListChecks,
      tone: "blue",
    },
    {
      label: "Last 24 hours",
      value: stats?.last24Hours ?? 0,
      detail: "Recent activity",
      icon: Activity,
      tone: "purple",
    },
    {
      label: "Security events",
      value: stats?.securityEvents ?? 0,
      detail: "MFA and token activity",
      icon: ShieldCheck,
      tone: "green",
    },
    {
      label: "Failed actions",
      value: stats?.failures ?? 0,
      detail: "Requires review",
      icon: CircleX,
      tone: "red",
    },
    {
      label: "Known actors",
      value: stats?.uniqueActors ?? 0,
      detail: "Identified user accounts",
      icon: Fingerprint,
      tone: "amber",
    },
  ];

  return (
    <section
      aria-label="Audit statistics"
      aria-busy={stats === null}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map(({ label, value, detail, icon: Icon, tone }) => (
        <article
          key={label}
          className={`flex min-h-[112px] items-start gap-4 rounded-xl border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,.02),0_4px_12px_rgba(16,24,40,.025)] ${label === "Total events" ? "border-[#ccd9fb]" : "border-border"}`}
        >
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-xl ${toneClasses[tone]}`}
          >
            <Icon className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="truncate text-[12px] text-[#526180]">{label}</p>
            <p className="mt-0.5 text-[24px] font-bold leading-none tracking-[-0.03em] text-foreground tabular-nums">
              {stats === null ? "—" : value}
            </p>
            <p className="mt-2 truncate text-[11px] text-muted-foreground">
              {stats === null ? "Loading…" : detail}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
