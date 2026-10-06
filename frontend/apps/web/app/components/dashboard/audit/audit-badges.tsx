import {
  CarFront,
  CircleCheck,
  CircleX,
  KeyRound,
  Settings,
  ShieldCheck,
  Siren,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import type {
  AuditActorType,
  AuditCategory,
  AuditOutcome,
} from "../../../../lib/api/admin-audit";

export const AUDIT_CATEGORY: Record<
  AuditCategory,
  { label: string; icon: LucideIcon; className: string }
> = {
  ACCOUNT: {
    label: "Account",
    icon: UserRound,
    className: "border-[#cad8fc] bg-[#eef3ff] text-[#3047d9]",
  },
  ACCESS: {
    label: "Access",
    icon: KeyRound,
    className: "border-[#ddcdf8] bg-[#f4edff] text-[#7f3ce5]",
  },
  SECURITY: {
    label: "Security",
    icon: ShieldCheck,
    className: "border-[#bde4cf] bg-[#eaf8f0] text-[#13864d]",
  },
  FAMILY: {
    label: "Family",
    icon: UsersRound,
    className: "border-[#c8dcf6] bg-[#eef6ff] text-[#2365a8]",
  },
  DEVICE: {
    label: "Device",
    icon: CarFront,
    className: "border-[#d8dfe9] bg-[#f4f6f9] text-[#526180]",
  },
  SAFETY: {
    label: "Safety",
    icon: Siren,
    className: "border-[#f5c8ca] bg-[#fff0f1] text-[#c82d38]",
  },
  SYSTEM: {
    label: "System",
    icon: Settings,
    className: "border-[#d8dfe9] bg-[#f4f6f9] text-[#526180]",
  },
};

export function AuditCategoryBadge({
  category,
}: {
  category: AuditCategory;
}) {
  const config = AUDIT_CATEGORY[category];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`h-7 px-2.5 ${config.className}`}>
      <Icon className="size-3" /> {config.label}
    </Badge>
  );
}

export function AuditOutcomeBadge({ outcome }: { outcome: AuditOutcome }) {
  return outcome === "SUCCESS" ? (
    <Badge variant="success" className="h-7 px-2.5">
      <CircleCheck className="size-3" /> Success
    </Badge>
  ) : (
    <Badge variant="danger" className="h-7 px-2.5">
      <CircleX className="size-3" /> Failure
    </Badge>
  );
}

export function actorTypeLabel(type: AuditActorType): string {
  switch (type) {
    case "USER":
      return "User";
    case "DEVICE":
      return "Vehicle device";
    case "CLI":
      return "Command line";
    default:
      return "System";
  }
}

export function formatAuditAction(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => {
      if (word === "mfa") return "MFA";
      if (word === "sos") return "SOS";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
