"use client";

import { motion } from "framer-motion";
import {
  CircleGauge,
  Clock3,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { AdminFamilyStats } from "../../../../lib/api/admin-families";
import {
  AnimatedNumber,
  cardHover,
  stagger,
  statCardMotion,
  statIconMotion,
} from "../motion";

type Tone = "blue" | "green" | "purple" | "amber";

const toneClasses: Record<Tone, string> = {
  blue: "bg-[#e9efff] text-[#3047d9]",
  green: "bg-[#eaf8f0] text-[#159455]",
  purple: "bg-[#f2eaff] text-[#7f3ce5]",
  amber: "bg-[#fff4dc] text-[#c17608]",
};

function percentage(value: number, total: number): string {
  return total === 0
    ? "0% of families"
    : `${Math.round((value / total) * 100)}% of families`;
}

export function FamilyStats({ stats }: { stats: AdminFamilyStats | null }) {
  const cards: Array<{
    label: string;
    value: number;
    decimals?: number;
    detail: string;
    icon: LucideIcon;
    tone: Tone;
  }> = [
    {
      label: "Total families",
      value: stats?.totalFamilies ?? 0,
      detail: "Across CabinGuard",
      icon: UsersRound,
      tone: "blue",
    },
    {
      label: "Family members",
      value: stats?.totalMembers ?? 0,
      detail: `${stats?.availableSeats ?? 0} open places`,
      icon: UserRoundCheck,
      tone: "green",
    },
    {
      label: "Average size",
      value: stats?.averageMembers ?? 0,
      decimals: 1,
      detail: `of ${stats?.maxMembersPerFamily ?? 10} members`,
      icon: CircleGauge,
      tone: "purple",
    },
    {
      label: "At capacity",
      value: stats?.fullFamilies ?? 0,
      detail: percentage(stats?.fullFamilies ?? 0, stats?.totalFamilies ?? 0),
      icon: ShieldCheck,
      tone: "blue",
    },
    {
      label: "Pending requests",
      value: stats?.pendingRequests ?? 0,
      detail: "Needs owner review",
      icon: Clock3,
      tone: "amber",
    },
  ];

  return (
    <motion.section
      aria-label="Family statistics"
      aria-busy={stats === null}
      variants={stagger(0.05)}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map(
        ({ label, value, decimals, detail, icon: Icon, tone }, index) => (
          <motion.article
            key={label}
            // Offset from the middle card: outer cards travel furthest inwards.
            custom={index - (cards.length - 1) / 2}
            variants={statCardMotion.families}
            whileHover={cardHover}
            className={`flex min-h-[112px] items-start gap-4 rounded-xl border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,.02),0_4px_12px_rgba(16,24,40,.025)] ${label === "Total families" ? "border-[#ccd9fb]" : "border-border"}`}
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
                {stats === null ? (
                  "—"
                ) : (
                  <AnimatedNumber value={value} decimals={decimals} />
                )}
              </p>
              <p className="mt-2 truncate text-[11px] text-muted-foreground">
                {stats === null ? "Loading…" : detail}
              </p>
            </div>
          </motion.article>
        ),
      )}
    </motion.section>
  );
}
