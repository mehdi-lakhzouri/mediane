import {
  Ban,
  Check,
  Clock3,
  History,
  TimerOff,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import type { AdminInvitationStatus } from "../../../../lib/api/admin-invitations";

const STATUS = {
  PENDING: {
    label: "Pending",
    variant: "secondary" as const,
    icon: Clock3,
  },
  ACCEPTED: {
    label: "Accepted",
    variant: "success" as const,
    icon: Check,
  },
  EXPIRED: {
    label: "Expired",
    variant: "warning" as const,
    icon: TimerOff,
  },
  REVOKED: {
    label: "Revoked",
    variant: "danger" as const,
    icon: Ban,
  },
  SUPERSEDED: {
    label: "Superseded",
    variant: "outline" as const,
    icon: History,
  },
};

export function InvitationStatusBadge({
  status,
}: {
  status: AdminInvitationStatus;
}) {
  const config = STATUS[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="h-7 px-2.5">
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}
