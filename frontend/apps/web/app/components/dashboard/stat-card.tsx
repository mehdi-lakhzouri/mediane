import type { LucideIcon } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";

export interface StatCardProps {
  label: string;
  /** null while the metric has no source: rendered as a muted placeholder. */
  value: string | null;
  icon: LucideIcon;
  /**
   * Badge under the value. Neutral by default: amber is reserved for the
   * system status card, where it means something needs attention.
   */
  status: { text: string; variant: "outline" | "success" | "warning" };
}

export function StatCard({ label, value, icon: Icon, status }: StatCardProps) {
  return (
    <Card className="p-5">
      <span className="grid size-10 place-items-center rounded-[10px] bg-secondary">
        <Icon className="size-5 text-primary" strokeWidth={2} />
      </span>

      {/* Mono + tabular figures: metrics read as instrument output and digits
          stay aligned from card to card as values change. */}
      <p
        className={
          value === null
            ? "mt-4 font-mono text-[30px] font-normal leading-none text-muted-foreground/45"
            : "mt-4 font-mono text-[30px] font-semibold leading-none tracking-tight text-foreground tabular-nums"
        }
      >
        {value ?? "—"}
      </p>
      <p className="mt-2 text-[13px] font-semibold text-foreground">{label}</p>

      <Badge variant={status.variant} className="mt-3">
        {status.text}
      </Badge>
    </Card>
  );
}
