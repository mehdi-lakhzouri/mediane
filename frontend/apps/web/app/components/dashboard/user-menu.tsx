"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LoaderCircle, LogOut, UserRound } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  fullName,
  initials,
  logout,
  type CurrentUser,
} from "../../../lib/api/auth";

const ROLE_LABEL: Record<CurrentUser["role"], string> = {
  ADMIN: "Administrator",
  DRIVER: "Driver",
};

export function UserMenu({
  user,
  collapsed,
}: {
  user: CurrentUser;
  collapsed: boolean;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // The session is gone either way; always return to sign in.
    } finally {
      router.replace("/sign-in");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${fullName(user)}`}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors",
          "hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-white/70",
          "data-[state=open]:bg-sidebar-hover",
          collapsed && "lg:justify-center lg:p-2",
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 text-[12px] font-bold text-white ring-1 ring-white/20">
          {initials(user)}
        </span>
        <span
          className={cn(
            "flex min-w-0 flex-1 flex-col leading-tight",
            collapsed && "lg:hidden",
          )}
        >
          <span className="truncate text-[13px] font-semibold text-sidebar-foreground">
            {fullName(user)}
          </span>
          <span className="truncate text-[11px] text-sidebar-muted">
            {user.email}
          </span>
        </span>
        <ChevronsUpDown
          className={cn(
            "size-4 shrink-0 text-sidebar-muted",
            collapsed && "lg:hidden",
          )}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-[232px]">
        <DropdownMenuLabel>
          <span className="block truncate text-[13px] font-semibold text-foreground">
            {fullName(user)}
          </span>
          <span className="mt-0.5 block truncate text-[12px] font-normal text-muted-foreground">
            {user.email}
          </span>
          <span className="mt-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
            {ROLE_LABEL[user.role]}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile">
            <UserRound />
            Profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          onSelect={(event) => {
            // Keep the menu open while the request is in flight.
            event.preventDefault();
            void handleSignOut();
          }}
        >
          {signingOut ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <LogOut />
          )}
          {signingOut ? "Signing out" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
