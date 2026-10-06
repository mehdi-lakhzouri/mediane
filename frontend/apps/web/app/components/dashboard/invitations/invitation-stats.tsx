"use client";

import { motion } from "framer-motion";
import {
  Ban,
  CircleCheckBig,
  Clock3,
  MailCheck,
  TimerOff,
  type LucideIcon,
} from "lucide-react";
import type { AdminInvitationStats } from "../../../../lib/api/admin-invitations";
import {
  AnimatedNumber,
  cardHover,
  stagger,
  statCardMotion,
  statIconMotion,
} from "../motion";

type Tone = "blue" | "green" | "purple" | "amber" | "red";

const toneClasses: Record<Tone, string> = {
  blue: "bg-[#e9efff] text-[#3047d9]",
  green: "bg-[#eaf8f0] text-[#159455]",
  purple: "bg-[#f2eaff] text-[#7f3ce5]",
  amber: "bg-[#fff4dc] text-[#c17608]",
  red: "bg-[#feedee] text-[#d92d3a]",
};

export function InvitationStats({
  stats,
}: {
  stats: AdminInvitationStats | null;
}) {
  const cards: Array<{
    label: string;
    value: number;
    detail: string;
    icon: LucideIcon;
    tone: Tone;
  }> = [
    {
      label: "Total issued",
      value: stats?.total ?? 0,
      detail: "All invitation attempts",
      icon: MailCheck,
      tone: "blue",
    },
    {
      label: "Pending",
      value: stats?.pending ?? 0,
      detail: "Links still active",
      icon: Clock3,
      tone: "purple",
    },
    {
      label: "Accepted",
      value: stats?.accepted ?? 0,
      detail: `${stats?.acceptanceRate ?? 0}% acceptance rate`,
      icon: CircleCheckBig,
      tone: "green",
    },
    {
      label: "Expired",
      value: stats?.expired ?? 0,
      detail: "Can be sent again",
      icon: TimerOff,
      tone: "amber",
    },
    {
      label: "Closed",
      value: (stats?.revoked ?? 0) + (stats?.superseded ?? 0),
      detail: `${stats?.revoked ?? 0} revoked · ${stats?.superseded ?? 0} replaced`,
      icon: Ban,
      tone: "red",
    },
  ];

  return (
    <motion.section
      aria-label="Invitation statistics"
      aria-busy={stats === null}
      variants={stagger(0.08)}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map(({ label, value, detail, icon: Icon, tone }) => (
        <motion.article
          key={label}
          variants={statCardMotion.invitations}
          whileHover={cardHover}
          style={{ transformOrigin: "top center" }}
          className={`flex min-h-[112px] items-start gap-4 rounded-xl border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,.02),0_4px_12px_rgba(16,24,40,.025)] ${label === "Total issued" ? "border-[#ccd9fb]" : "border-border"}`}
        >
          <motion.span
            variants={statIconMotion}
            className={`grid size-12 shrink-0 place-items-center rounded-xl ${toneClasses[tone]}`}
          >
            <Icon className="size-5" strokeWidth={2} />
          </motion.span>
          <div className="min-w-0 pt-0.5">
            <p className="truncate text-[12px] text-[#526180]">{label}</p>
            <p className="mt-0.5 text-[24px] font-bold leading-none tracking-[-0.03em] text-foreground tabular-nums">
              {stats === null ? "—" : <AnimatedNumber value={value} />}
            </p>
            <p className="mt-2 truncate text-[11px] text-muted-foreground">
              {stats === null ? "Loading…" : detail}
            </p>
          </div>
        </motion.article>
      ))}
    </motion.section>
  );
}
