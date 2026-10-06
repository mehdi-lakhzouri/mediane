"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronDown, Command, House, Menu, Search } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { fullName, initials, type CurrentUser } from "../../../lib/api/auth";
import { getUnreadNotificationCount } from "../../../lib/api/notifications";

interface TopbarProps {
  section: string;
  user: CurrentUser;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
}

export function Topbar({
  section,
  user,
  collapsed,
  onToggleCollapsed,
  onOpenMobile,
}: TopbarProps) {
  const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getUnreadNotificationCount()
      .then((count) => active && setUnread(count))
      .catch(() => active && setUnread(null));
    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="cg-topbar sticky top-0 z-20 flex h-[50px] shrink-0 items-center gap-2 border-b border-border bg-card px-4 transition-[padding] duration-200 sm:px-7">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onOpenMobile}
        aria-label="Open menu"
        className="lg:hidden"
      >
        <Menu />
      </Button>

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleCollapsed}
              aria-pressed={collapsed}
              aria-label={collapseLabel}
              className="hidden size-8 text-[#536584] lg:inline-flex"
            >
              <House className="size-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{collapseLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div
        aria-hidden="true"
        className="mx-1 hidden h-5 w-px bg-border lg:block"
      />

      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-2 text-[13px]">
          <li className="hidden font-medium text-muted-foreground sm:block">
            CabinGuard
          </li>
          <li aria-hidden="true" className="hidden text-border sm:block">
            /
          </li>
          <li className="truncate font-semibold text-foreground">{section}</li>
        </ol>
      </nav>

      <label className="absolute left-1/2 hidden h-[34px] w-[440px] -translate-x-1/2 items-center gap-2 rounded-[7px] border border-[#dce4ef] bg-[#f7f9fc] px-3 text-[#617190] shadow-[0_1px_2px_rgba(16,24,40,.025)] xl:flex">
        <Search className="size-[17px] shrink-0" />
        <input
          type="search"
          aria-label="Search dashboard"
          placeholder="Search users, families, or settings..."
          className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-[#7787a4]"
        />
        <span className="flex items-center gap-0.5 rounded bg-[#eef1f6] px-1.5 py-0.5 text-[10px] font-semibold text-[#8190a9]">
          <Command className="size-3" />K
        </span>
      </label>

      <div className="ml-auto flex h-full items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={
            unread === null
              ? "Notifications"
              : `${unread} unread notification${unread === 1 ? "" : "s"}`
          }
          className="relative size-8 text-[#526180]"
        >
          <Bell className="size-[18px]" />
          {unread !== null && unread > 0 ? (
            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-[#f04438] ring-2 ring-white" />
          ) : null}
        </Button>
        <span className="h-6 w-px bg-[#e7ebf2]" />
        <button
          type="button"
          className="hidden h-full items-center gap-2.5 px-1 text-left sm:flex"
          aria-label={`Account menu for ${fullName(user)}`}
        >
          <span className="grid size-9 place-items-center rounded-full bg-[#465da1] text-[12px] font-bold text-white">
            {initials(user)}
          </span>
          <span className="hidden min-w-0 flex-col leading-tight lg:flex">
            <span className="max-w-[150px] truncate text-[12px] font-semibold text-[#111a32]">
              {fullName(user)}
            </span>
            <span className="text-[10px] text-[#687795]">
              {user.role === "ADMIN" ? "Administrator" : "Driver"}
            </span>
          </span>
          <ChevronDown className="size-4 text-[#3c5279]" />
        </button>
      </div>
    </header>
  );
}
