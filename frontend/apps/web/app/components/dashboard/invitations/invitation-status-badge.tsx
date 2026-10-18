"use client";

import { Ban, Check, Clock3, History, TimerOff } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import type { AdminInvitationStatus } from "../../../../lib/api/admin-invitations";
import { useMessages } from "../../../../lib/i18n/locale-provider";
import { labelMessages } from "../labels";

const STATUS = {
  PENDING: {
    variant: "secondary" as const,
    icon: Clock3,
  },
  ACCEPTED: {
    variant: "success" as const,
    icon: Check,
  },
  EXPIRED: {
    variant: "warning" as const,
    icon: TimerOff,
  },
  REVOKED: {
    variant: "danger" as const,
    icon: Ban,
  },
  SUPERSEDED: {
    variant: "outline" as const,
    icon: History,
  },
};

export function InvitationStatusBadge({
  status,
}: {
  status: AdminInvitationStatus;
}) {
  const labels = useMessages(labelMessages);
  const config = STATUS[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="h-7 px-2.5">
      <Icon className="size-3" />
      {labels.invitationStatus[status]}
    </Badge>
  );
}
