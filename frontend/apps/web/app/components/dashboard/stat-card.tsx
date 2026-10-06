"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  AnimatedNumber,
  cardHover,
  statCardMotion,
  statIconMotion,
} from "./motion";

const MotionCard = motion.create(Card);

export interface StatCardProps {
  label: string;
  /** null means this metric does not have an administrator-facing source. */
  value: string | number | null;
  icon: LucideIcon;
  loading?: boolean;
  /**
   * Badge under the value. Neutral by default: amber is reserved for the
   * system status card, where it means something needs attention.
   */
  status: { text: string; variant: "outline" | "success" | "warning" };
}

export function StatCard({
  label,
  value,
  icon: Icon,
  loading = false,
  status,
}: StatCardProps) {
  return (
    <MotionCard
      variants={statCardMotion.overview}
      whileHover={cardHover}
      className="min-h-[136px] p-4"
    >
      <div className="flex items-center gap-3">
        <motion.span
          variants={statIconMotion}
          className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-secondary"
        >
          <Icon className="size-5 text-primary" strokeWidth={2} />
        </motion.span>
        <p className="text-[13px] font-bold text-foreground">{label}</p>
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {loading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p
              className={
                value === null
                  ? "font-mono text-[25px] font-medium leading-none text-muted-foreground/45"
                  : "font-mono text-[25px] font-bold leading-none tracking-tight text-foreground tabular-nums"
              }
            >
              {typeof value === "number" ? (
                <AnimatedNumber value={value} />
              ) : (
                (value ?? "—")
              )}
            </p>
          )}
          <Badge
            variant={status.variant}
            className="mt-1.5 h-[22px] px-2 py-0 text-[10px]"
          >
            {status.text}
          </Badge>
        </div>
        <span aria-hidden="true" className="mb-4 h-px w-12 bg-border" />
      </div>
    </MotionCard>
  );
}
