import { Badge } from "@repo/ui/components/ui/badge";
import { Crown } from "lucide-react";
import type { AccountState } from "../../../../lib/api/admin-users";
import type { Role } from "../../../../lib/api/auth";

type BadgeVariant =
  "default" | "secondary" | "outline" | "success" | "warning" | "danger";

/**
 * The account state is derived server-side from several independent facts, so
 * one badge can say where a person actually is in onboarding.
 */
const ACCOUNT_STATE: Record<
  AccountState,
  { label: string; variant: BadgeVariant }
> = {
  INVITED: { label: "Invited", variant: "secondary" },
  PASSWORD_CHANGE_REQUIRED: {
    label: "Temporary password",
    variant: "warning",
  },
  PROFILE_SETUP_REQUIRED: { label: "Profile pending", variant: "warning" },
  ACTIVE: { label: "Active", variant: "success" },
  SUSPENDED: { label: "Suspended", variant: "danger" },
  DELETED: { label: "Deleted", variant: "outline" },
};

export function AccountStateBadge({ state }: { state: AccountState }) {
  const { label, variant } = ACCOUNT_STATE[state];
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
  return (
    <Badge
      variant={role === "ADMIN" ? "default" : "outline"}
      className="h-7 px-2.5"
    >
      {role === "ADMIN" && <Crown className="size-3" />}
      {role === "ADMIN" ? "Admin" : "Driver"}
    </Badge>
  );
}
