"use client";
import { Badge } from "@repo/ui/components/ui/badge";
import type { IncidentStatus } from "../../../lib/api/admin-incidents";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { incidentMessages } from "./incidents.messages";

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const t = useMessages(incidentMessages);
  const labels = {
    AWAITING_RESPONSE: t.awaiting,
    ESCALATED: t.escalated,
    RESOLVED: t.resolved,
    FALSE_ALARM: t.cancelled,
  };
  return (
    <Badge
      variant={
        status === "ESCALATED"
          ? "danger"
          : status === "AWAITING_RESPONSE"
            ? "warning"
            : status === "RESOLVED"
              ? "success"
              : "outline"
      }
      className="gap-1.5 text-[11px]"
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {labels[status] ?? t.unknown}
    </Badge>
  );
}
