"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { useFormatters } from "../../../lib/i18n/locale-provider";
import { PulseDot } from "./motion";

/**
 * Page header control for screens that refresh on their own: a live dot with
 * the time of the last answer, and a secondary button to refresh now. The
 * page's primary action (if any) keeps the filled button.
 */
export function LiveRefresh({
  fetching,
  stale,
  updatedAt,
  onRefresh,
  labels,
}: {
  fetching: boolean;
  stale: boolean;
  updatedAt: number | null;
  onRefresh: () => void;
  labels: {
    autoRefresh: string;
    updated: string;
    waiting: string;
    refresh: string;
    refreshing: string;
  };
}) {
  const format = useFormatters();
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span
        className={cn(
          "inline-flex h-[46px] items-center gap-2.5 rounded-[9px] border bg-card px-3.5 text-[12px]",
          stale
            ? "border-warning/40 text-warning-strong"
            : "border-border text-muted-foreground",
        )}
      >
        <PulseDot
          live={!stale}
          className={stale ? "bg-warning" : "bg-success"}
        />
        <span className="flex flex-col leading-tight">
          <span className="font-semibold text-foreground">
            {labels.autoRefresh}
          </span>
          <span>
            {updatedAt
              ? `${labels.updated} · ${format.dateTime(new Date(updatedAt))}`
              : labels.waiting}
          </span>
        </span>
      </span>
      <Button
        variant="outline"
        size="lg"
        disabled={fetching}
        onClick={onRefresh}
        className="h-[46px] rounded-[9px] bg-card px-5"
      >
        <RefreshCw className={cn("size-4", fetching && "animate-spin")} />
        {fetching ? labels.refreshing : labels.refresh}
      </Button>
    </div>
  );
}
