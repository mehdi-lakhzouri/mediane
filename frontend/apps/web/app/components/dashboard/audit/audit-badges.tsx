"use client";

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
  AuditCategory,
  AuditOutcome,
} from "../../../../lib/api/admin-audit";
import { useMessages } from "../../../../lib/i18n/locale-provider";
import { labelMessages } from "../labels";

export const AUDIT_CATEGORY: Record<
  AuditCategory,
  { icon: LucideIcon; className: string }
> = {
  ACCOUNT: {
    icon: UserRound,
    className: "border-[#cad8fc] bg-[#eef3ff] text-[#3047d9]",
  },
  ACCESS: {
    icon: KeyRound,
    className: "border-[#ddcdf8] bg-[#f4edff] text-[#7f3ce5]",
  },
  SECURITY: {
    icon: ShieldCheck,
    className: "border-[#bde4cf] bg-[#eaf8f0] text-[#13864d]",
  },
  FAMILY: {
    icon: UsersRound,
    className: "border-[#c8dcf6] bg-[#eef6ff] text-[#2365a8]",
  },
  DEVICE: {
    icon: CarFront,
    className: "border-[#d8dfe9] bg-[#f4f6f9] text-[#526180]",
  },
  SAFETY: {
    icon: Siren,
    className: "border-[#f5c8ca] bg-[#fff0f1] text-[#c82d38]",
  },
  SYSTEM: {
    icon: Settings,
    className: "border-[#d8dfe9] bg-[#f4f6f9] text-[#526180]",
  },
};

export function AuditCategoryBadge({ category }: { category: AuditCategory }) {
  const labels = useMessages(labelMessages);
  const config = AUDIT_CATEGORY[category];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`h-7 px-2.5 ${config.className}`}>
      <Icon className="size-3" /> {labels.auditCategory[category]}
    </Badge>
  );
}

export function AuditOutcomeBadge({ outcome }: { outcome: AuditOutcome }) {
  const labels = useMessages(labelMessages);
  return outcome === "SUCCESS" ? (
    <Badge variant="success" className="h-7 px-2.5">
      <CircleCheck className="size-3" /> {labels.auditOutcome.SUCCESS}
    </Badge>
  ) : (
    <Badge variant="danger" className="h-7 px-2.5">
      <CircleX className="size-3" /> {labels.auditOutcome.FAILURE}
    </Badge>
  );
}
