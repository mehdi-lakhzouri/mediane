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
  useFormatters,
  useMessages,
} from "../../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../../lib/i18n/messages";
import {
  AnimatedNumber,
  cardHover,
  stagger,
  statCardMotion,
  statIconMotion,
} from "../motion";

const messages = defineMessages({
  en: {
    label: "Family statistics",
    loading: "Loading…",
    total: "Total families",
    totalHint: "Across CabinGuard",
    members: "Family members",
    openPlaces: (count: number) => `${count} open places`,
    average: "Average size",
    ofMax: (max: number) => `of ${max} members`,
    full: "At capacity",
    ofFamilies: (percent: string) => `${percent} of families`,
    pending: "Pending requests",
    pendingHint: "Needs owner review",
  },
  fr: {
    label: "Statistiques des familles",
    loading: "Chargement…",
    total: "Familles",
    totalHint: "Sur CabinGuard",
    members: "Membres",
    openPlaces: (count: number) =>
      `${count} place${count > 1 ? "s" : ""} libre${count > 1 ? "s" : ""}`,
    average: "Taille moyenne",
    ofMax: (max: number) => `sur ${max} membres`,
    full: "Complètes",
    ofFamilies: (percent: string) => `${percent} des familles`,
    pending: "Demandes",
    pendingHint: "À valider",
  },
});

type Tone = "blue" | "green" | "purple" | "amber";

const toneClasses: Record<Tone, string> = {
  blue: "bg-[#e9efff] text-[#3047d9]",
  green: "bg-[#eaf8f0] text-[#159455]",
  purple: "bg-[#f2eaff] text-[#7f3ce5]",
  amber: "bg-[#fff4dc] text-[#c17608]",
};

export function FamilyStats({ stats }: { stats: AdminFamilyStats | null }) {
  const t = useMessages(messages);
  const format = useFormatters();
  const percentage = (value: number, total: number) =>
    t.ofFamilies(
      format.number(total === 0 ? 0 : value / total, {
        style: "percent",
        maximumFractionDigits: 0,
      }),
    );
  const cards: Array<{
    label: string;
    value: number;
    decimals?: number;
    detail: string;
    icon: LucideIcon;
    tone: Tone;
  }> = [
    {
      label: t.total,
      value: stats?.totalFamilies ?? 0,
      detail: t.totalHint,
      icon: UsersRound,
      tone: "blue",
    },
    {
      label: t.members,
      value: stats?.totalMembers ?? 0,
      detail: t.openPlaces(stats?.availableSeats ?? 0),
      icon: UserRoundCheck,
      tone: "green",
    },
    {
      label: t.average,
      value: stats?.averageMembers ?? 0,
      decimals: 1,
      detail: t.ofMax(stats?.maxMembersPerFamily ?? 10),
      icon: CircleGauge,
      tone: "purple",
    },
    {
      label: t.full,
      value: stats?.fullFamilies ?? 0,
      detail: percentage(stats?.fullFamilies ?? 0, stats?.totalFamilies ?? 0),
      icon: ShieldCheck,
      tone: "blue",
    },
    {
      label: t.pending,
      value: stats?.pendingRequests ?? 0,
      detail: t.pendingHint,
      icon: Clock3,
      tone: "amber",
    },
  ];

  return (
    <motion.section
      aria-label={t.label}
      aria-busy={stats === null}
      variants={stagger(0.05)}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5"
    >
      {cards.map(
        ({ label, value, decimals, detail, icon: Icon, tone }, index) => (
          <motion.article
            key={index}
            // Offset from the middle card: outer cards travel furthest inwards.
            custom={index - (cards.length - 1) / 2}
            variants={statCardMotion.families}
            whileHover={cardHover}
            className={`flex min-h-[112px] items-start gap-4 rounded-xl border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,.02),0_4px_12px_rgba(16,24,40,.025)] ${index === 0 ? "border-[#ccd9fb]" : "border-border"}`}
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
                {stats === null ? t.loading : detail}
              </p>
            </div>
          </motion.article>
        ),
      )}
    </motion.section>
  );
}
