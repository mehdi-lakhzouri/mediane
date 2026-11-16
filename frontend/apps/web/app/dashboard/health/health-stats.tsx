"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Layers3,
  Radio,
  Server,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import type { AdminDevice } from "../../../lib/api/admin-devices";
import { useFormatters, useMessages } from "../../../lib/i18n/locale-provider";
import {
  AnimatedNumber,
  cardHover,
  stagger,
  statCardMotion,
  statIconMotion,
} from "../../components/dashboard/motion";
import { healthMessages } from "./health-screen.messages";
import { deviceHealth } from "./health-status";

export function HealthStats({
  devices,
  now,
  failed,
  loading,
  known,
}: {
  devices: AdminDevice[];
  now: number;
  failed: boolean;
  loading: boolean;
  known: boolean;
}) {
  const t = useMessages(healthMessages);
  const format = useFormatters();
  const health = devices.map((device) => deviceHealth(device, now));
  const ready = health.filter((item) => item.state === "READY").length;
  const cards: {
    label: string;
    value: number | null;
    detail: string;
    icon: LucideIcon;
    tone: string;
  }[] = [
    {
      label: t.total,
      value: known ? devices.length : null,
      detail: failed
        ? t.stale
        : t.pairedCount(
            format.number(
              devices.filter((device) => !!device.pairedUserId).length,
            ),
          ),
      icon: Server,
      tone: "bg-[#e9efff] text-[#3047d9]",
    },
    {
      label: t.online,
      value: failed ? null : health.filter((item) => item.online).length,
      detail: t.onlineHint,
      icon: Radio,
      tone: "bg-[#eaf8f0] text-[#159455]",
    },
    {
      label: t.readyCount,
      value: failed ? null : ready,
      detail: t.readyHint,
      icon: Activity,
      tone: "bg-[#f2eaff] text-[#7f3ce5]",
    },
    {
      label: t.attention,
      value: failed ? null : devices.length - ready,
      detail: t.attentionHint,
      icon: AlertCircle,
      tone: "bg-[#fff5e6] text-[#b76b08]",
    },
    {
      label: t.pendingCount,
      value: failed
        ? null
        : health.reduce((total, item) => total + (item.queue ?? 0), 0),
      detail: t.pendingHint,
      icon: Layers3,
      tone: "bg-[#e9efff] text-[#3047d9]",
    },
  ];
  return (
    <motion.section
      aria-label={t.statsLabel}
      variants={stagger(0.06)}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map(({ label, value, detail, icon: Icon, tone }, index) => (
        <motion.article
          key={label}
          variants={statCardMotion.drivers}
          whileHover={cardHover}
          className={`flex min-h-[112px] items-start gap-4 rounded-xl border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,.02),0_4px_12px_rgba(16,24,40,.025)] ${index === 0 ? "border-[#ccd9fb]" : "border-border"}`}
        >
          <motion.span
            variants={statIconMotion}
            className={`grid size-12 shrink-0 place-items-center rounded-xl ${tone}`}
          >
            <Icon className="size-5" strokeWidth={2} />
          </motion.span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[12px] text-[#526180]">{label}</p>
            {loading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-[24px] font-bold leading-none tracking-[-0.03em] text-foreground tabular-nums">
                {value === null ? "—" : <AnimatedNumber value={value} />}
              </p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              {failed && (!known || index > 0)
                ? t.reasons.refreshFailed
                : detail}
            </p>
          </div>
        </motion.article>
      ))}
    </motion.section>
  );
}
