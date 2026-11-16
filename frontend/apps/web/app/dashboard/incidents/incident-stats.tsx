"use client";
import { motion } from "framer-motion";
import {
  BellRing,
  CircleCheck,
  ClipboardList,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import type { AdminIncidentStats } from "../../../lib/api/admin-incidents";
import { useMessages } from "../../../lib/i18n/locale-provider";
import {
  AnimatedNumber,
  cardHover,
  stagger,
  statCardMotion,
  statIconMotion,
} from "../../components/dashboard/motion";
import { incidentMessages } from "./incidents.messages";

export function IncidentStats({
  stats,
  loading,
}: {
  stats: AdminIncidentStats | null;
  loading: boolean;
}) {
  const t = useMessages(incidentMessages);
  const cards = [
    {
      label: t.total,
      value: stats?.total,
      hint: t.totalHint,
      icon: ClipboardList,
      tone: "bg-[#e9efff] text-[#3047d9]",
    },
    {
      label: t.awaiting,
      value: stats?.awaitingResponse,
      hint: t.awaitingHint,
      icon: Clock3,
      tone: "bg-[#fff5e6] text-[#b76b08]",
    },
    {
      label: t.escalated,
      value: stats?.escalated,
      hint: t.escalatedHint,
      icon: BellRing,
      tone: "bg-[#feedee] text-[#d92d3a]",
    },
    {
      label: t.resolved,
      value: stats?.resolved,
      hint: t.resolvedHint,
      icon: CircleCheck,
      tone: "bg-[#eaf8f0] text-[#159455]",
    },
    {
      label: t.cancelled,
      value: stats?.falseAlarm,
      hint: t.cancelledHint,
      icon: ShieldCheck,
      tone: "bg-[#f2eaff] text-[#7f3ce5]",
    },
  ];
  return (
    <motion.section
      aria-label={t.statsLabel}
      variants={stagger(0.06)}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map(({ label, value, hint, icon: Icon, tone }, index) => (
        <motion.article
          key={label}
          variants={statCardMotion.drivers}
          whileHover={cardHover}
          className={`flex min-h-[112px] items-start gap-4 rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,.02),0_4px_12px_rgba(16,24,40,.025)] ${index === 0 ? "border-[#ccd9fb]" : "border-border"}`}
        >
          <motion.span
            variants={statIconMotion}
            className={`grid size-12 shrink-0 place-items-center rounded-xl ${tone}`}
          >
            <Icon className="size-5" />
          </motion.span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[12px] text-[#526180]">{label}</p>
            {loading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-[24px] font-bold leading-none tracking-[-0.03em] tabular-nums">
                {value == null ? "—" : <AnimatedNumber value={value} />}
              </p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
          </div>
        </motion.article>
      ))}
    </motion.section>
  );
}
