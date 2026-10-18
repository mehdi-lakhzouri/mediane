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
    label: "Invitation statistics",
    loading: "Loading…",
    total: "Total issued",
    totalHint: "All invitation attempts",
    pending: "Pending",
    pendingHint: "Links still active",
    accepted: "Accepted",
    acceptance: (percent: string) => `${percent} acceptance rate`,
    expired: "Expired",
    expiredHint: "Can be sent again",
    closed: "Closed",
    closedHint: (revoked: number, replaced: number) =>
      `${revoked} revoked · ${replaced} replaced`,
  },
  fr: {
    label: "Statistiques des invitations",
    loading: "Chargement…",
    total: "Total envoyé",
    totalHint: "Toutes les tentatives d’invitation",
    pending: "En attente",
    pendingHint: "Liens encore actifs",
    accepted: "Acceptées",
    acceptance: (percent: string) => `${percent} d’acceptation`,
    expired: "Expirées",
    expiredHint: "Peuvent être renvoyées",
    closed: "Clôturées",
    closedHint: (revoked: number, replaced: number) =>
      `${revoked} révoquée${revoked > 1 ? "s" : ""} · ${replaced} remplacée${replaced > 1 ? "s" : ""}`,
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

export function InvitationStats({
  stats,
}: {
  stats: AdminInvitationStats | null;
}) {
  const t = useMessages(messages);
  const format = useFormatters();
  const cards: Array<{
    label: string;
    value: number;
    detail: string;
    icon: LucideIcon;
    tone: Tone;
  }> = [
    {
      label: t.total,
      value: stats?.total ?? 0,
      detail: t.totalHint,
      icon: MailCheck,
      tone: "blue",
    },
    {
      label: t.pending,
      value: stats?.pending ?? 0,
      detail: t.pendingHint,
      icon: Clock3,
      tone: "purple",
    },
    {
      label: t.accepted,
      value: stats?.accepted ?? 0,
      detail: t.acceptance(
        format.number((stats?.acceptanceRate ?? 0) / 100, {
          style: "percent",
          maximumFractionDigits: 1,
        }),
      ),
      icon: CircleCheckBig,
      tone: "green",
    },
    {
      label: t.expired,
      value: stats?.expired ?? 0,
      detail: t.expiredHint,
      icon: TimerOff,
      tone: "amber",
    },
    {
      label: t.closed,
      value: (stats?.revoked ?? 0) + (stats?.superseded ?? 0),
      detail: t.closedHint(stats?.revoked ?? 0, stats?.superseded ?? 0),
      icon: Ban,
      tone: "red",
    },
  ];

  return (
    <motion.section
      aria-label={t.label}
      aria-busy={stats === null}
      variants={stagger(0.08)}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5"
    >
      {cards.map(({ label, value, detail, icon: Icon, tone }, index) => (
        <motion.article
          key={index}
          variants={statCardMotion.invitations}
          whileHover={cardHover}
          style={{ transformOrigin: "top center" }}
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
              {stats === null ? "—" : <AnimatedNumber value={value} />}
            </p>
            <p className="mt-2 truncate text-[11px] text-muted-foreground">
              {stats === null ? t.loading : detail}
            </p>
          </div>
        </motion.article>
      ))}
    </motion.section>
  );
}
