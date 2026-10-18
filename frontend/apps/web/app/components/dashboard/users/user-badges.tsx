"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Crown } from "lucide-react";
import type { AccountState } from "../../../../lib/api/admin-users";
import type { Role } from "../../../../lib/api/auth";
import { useMessages } from "../../../../lib/i18n/locale-provider";
import { labelMessages } from "../labels";

type BadgeVariant =
  "default" | "secondary" | "outline" | "success" | "warning" | "danger";

/**
 * The account state is derived server-side from several independent facts, so
 * one badge can say where a person actually is in onboarding.
 */
const ACCOUNT_STATE_VARIANT: Record<AccountState, BadgeVariant> = {
  INVITED: "secondary",
  PASSWORD_CHANGE_REQUIRED: "warning",
  MFA_SETUP_REQUIRED: "warning",
  PROFILE_SETUP_REQUIRED: "warning",
  ACTIVE: "success",
  SUSPENDED: "danger",
  DELETED: "outline",
};

export function AccountStateBadge({ state }: { state: AccountState }) {
  const labels = useMessages(labelMessages);
  const label = labels.accountState[state];
  const variant = ACCOUNT_STATE_VARIANT[state];
  return (
    <Badge variant={variant} className="h-7 px-2.5">
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          state === "ACTIVE"
            ? "bg-success"
            : state === "SUSPENDED" || state === "DELETED"
              ? "bg-danger"
              : state === "INVITED"
                ? "bg-[#7f3ce5]"
                : "bg-warning"
        }`}
      />
      {label}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const labels = useMessages(labelMessages);
  return (
    <Badge
      variant={role === "ADMIN" ? "default" : "outline"}
      className="h-7 px-2.5"
    >
      {role === "ADMIN" && <Crown className="size-3" />}
      {labels.role[role]}
    </Badge>
  );
}
