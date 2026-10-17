"use client";

import { motion } from "framer-motion";
import {
  CircleX,
  Mail,
  ShieldCheck,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
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
    label: "User statistics",
    total: "Total users",
    thisMonth: "+2 this month",
    active: "Active users",
    invited: "Invited",
    suspended: "Suspended",
    admins: "Admins",
    ofTotal: (percent: string) => `${percent} of total`,
  },
  fr: {
    label: "Statistiques des utilisateurs",
    total: "Utilisateurs au total",
    thisMonth: "+2 ce mois-ci",
    active: "Utilisateurs actifs",
    invited: "Invités",
    suspended: "Suspendus",
    admins: "Admins",
    ofTotal: (percent: string) => `${percent} du total`,
  },
});

export interface UserStatsValue {
  total: number;
  active: number;
  invited: number;
  suspended: number;
  admins: number;
}

type Tone = "blue" | "green" | "purple" | "red";

const toneClasses: Record<Tone, string> = {
  blue: "bg-[#e9efff] text-[#3047d9]",
  green: "bg-[#eaf8f0] text-[#159455]",
  purple: "bg-[#f2eaff] text-[#7f3ce5]",
  red: "bg-[#feedee] text-[#d92d3a]",
};

export function UserStats({ stats }: { stats: UserStatsValue }) {
  const t = useMessages(messages);
  const format = useFormatters();
  const percentage = (value: number, total: number) =>
    t.ofTotal(
      format.number(total === 0 ? 0 : value / total, {
        style: "percent",
        maximumFractionDigits: 0,
      }),
    );
  const cards: Array<{
    label: string;
    value: number;
    detail: string;
    icon: LucideIcon;
    tone: Tone;
    positive?: boolean;
  }> = [
    {
      label: t.total,
      value: stats.total,
      detail: t.thisMonth,
      icon: Users,
      tone: "blue",
      positive: true,
    },
    {
      label: t.active,
      value: stats.active,
      detail: percentage(stats.active, stats.total),
      icon: UserRoundCheck,
      tone: "green",
    },
    {
      label: t.invited,
      value: stats.invited,
      detail: percentage(stats.invited, stats.total),
      icon: Mail,
      tone: "purple",
    },
    {
      label: t.suspended,
      value: stats.suspended,
      detail: percentage(stats.suspended, stats.total),
      icon: CircleX,
      tone: "red",
    },
    {
      label: t.admins,
      value: stats.admins,
      detail: percentage(stats.admins, stats.total),
      icon: ShieldCheck,
      tone: "blue",
    },
  ];

  return (
    <motion.section
      aria-label={t.label}
      variants={stagger(0.06)}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5"
    >
      {cards.map(
        ({ label, value, detail, icon: Icon, tone, positive }, index) => (
          <motion.article
            key={index}
            variants={statCardMotion.drivers}
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
                <AnimatedNumber value={value} />
              </p>
              <p
                className={`mt-2 truncate text-[11px] ${positive ? "font-medium text-[#159455]" : "text-muted-foreground"}`}
              >
                {positive ? "↑ " : ""}
                {detail}
              </p>
            </div>
          </motion.article>
        ),
      )}
    </motion.section>
  );
}
