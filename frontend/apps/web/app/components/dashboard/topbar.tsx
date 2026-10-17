"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { fullName, initials, type CurrentUser } from "../../../lib/api/auth";
import { getUnreadNotificationCount } from "../../../lib/api/notifications";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";
import { LanguageSwitch } from "../language-switch";
import { roleMessages } from "./user-menu";

const messages = defineMessages({
  en: {
    expand: "Expand sidebar",
    collapse: "Collapse sidebar",
    openMenu: "Open menu",
    breadcrumb: "Breadcrumb",
    search: "Search dashboard",
    searchPlaceholder: "Search users, families, or settings...",
    notifications: "Notifications",
    unread: (count: number) =>
      `${count} unread notification${count === 1 ? "" : "s"}`,
    menuFor: (name: string) => `Account menu for ${name}`,
  },
  fr: {
    expand: "Déplier la barre latérale",
    collapse: "Replier la barre latérale",
    openMenu: "Ouvrir le menu",
    breadcrumb: "Fil d’Ariane",
    search: "Rechercher dans le tableau de bord",
    searchPlaceholder: "Rechercher utilisateurs, familles…",
    notifications: "Notifications",
    unread: (count: number) =>
      `${count} notification${count > 1 ? "s" : ""} non lue${count > 1 ? "s" : ""}`,
    menuFor: (name: string) => `Menu du compte de ${name}`,
  },
});

interface TopbarProps {
  section: string;
  user: CurrentUser;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
  onOpenSearch: () => void;
}

export function Topbar({
  section,
  user,
  collapsed,
  onToggleCollapsed,
  onOpenMobile,
  onOpenSearch,
}: TopbarProps) {
  const t = useMessages(messages);
  const roles = useMessages(roleMessages);
  const collapseLabel = collapsed ? t.expand : t.collapse;
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
    <header className="cg-topbar sticky top-0 z-20 flex h-[58px] shrink-0 items-center gap-2 border-b border-border bg-card/95 px-4 shadow-[0_1px_0_rgba(16,24,40,.02)] backdrop-blur-xl transition-[padding] duration-200 sm:px-7">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onOpenMobile}
        aria-label={t.openMenu}
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
              {collapsed ? (
                <PanelLeftOpen className="size-[18px]" />
              ) : (
                <PanelLeftClose className="size-[18px]" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{collapseLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div
        aria-hidden="true"
        className="mx-1 hidden h-5 w-px bg-border lg:block"
      />

      <nav aria-label={t.breadcrumb} className="min-w-0">
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

      <button
        type="button"
        onClick={onOpenSearch}
        aria-label={t.search}
        className="absolute left-1/2 hidden h-9 w-[min(420px,34vw)] -translate-x-1/2 items-center gap-2 rounded-[9px] border border-[#dce4ef] bg-[#f7f9fc] px-3 text-left text-[#617190] shadow-[0_1px_2px_rgba(16,24,40,.025)] outline-none transition hover:border-[#c9d5e8] hover:bg-white hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring xl:flex"
      >
        <Search className="size-[17px] shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[11px] text-[#7787a4]">
          {t.searchPlaceholder}
        </span>
        <span className="flex items-center gap-0.5 rounded bg-[#eef1f6] px-1.5 py-0.5 text-[10px] font-semibold text-[#8190a9]">
          Ctrl K
        </span>
      </button>

      <div className="ml-auto flex h-full items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenSearch}
          aria-label={t.search}
          className="size-8 text-[#526180] xl:hidden"
        >
          <Search className="size-[18px]" />
        </Button>
        <LanguageSwitch variant="console" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={unread === null ? t.notifications : t.unread(unread)}
          className="relative size-8 text-[#526180]"
        >
          <Bell className="size-[18px]" />
          {unread !== null && unread > 0 ? (
            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-[#f04438] ring-2 ring-white" />
          ) : null}
        </Button>
        <span className="h-6 w-px bg-[#e7ebf2]" />
        <Link
          href="/dashboard/profile"
          className="hidden h-11 items-center gap-2.5 rounded-xl px-1.5 text-left outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:flex"
          aria-label={t.menuFor(fullName(user))}
        >
          <span className="grid size-9 place-items-center rounded-full bg-[#465da1] text-[12px] font-bold text-white">
            {initials(user)}
          </span>
          <span className="hidden min-w-0 flex-col leading-tight lg:flex">
            <span className="max-w-[150px] truncate text-[12px] font-semibold text-[#111a32]">
              {fullName(user)}
            </span>
            <span className="text-[10px] text-[#687795]">
              {roles[user.role]}
            </span>
          </span>
        </Link>
      </div>
    </header>
  );
}
