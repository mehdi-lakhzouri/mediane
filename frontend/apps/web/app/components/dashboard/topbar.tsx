"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  LayoutPanelLeft,
  LayoutPanelTop,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
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
import { activeHref, NAV_ITEMS, navMessages } from "../../dashboard/nav";

const messages = defineMessages({
  en: {
    expand: "Expand sidebar",
    collapse: "Collapse sidebar",
    openMenu: "Open menu",
    breadcrumb: "Breadcrumb",
    search: "Search dashboard",
    searchPlaceholder: "Search users, families, or settings...",
    notifications: "Notifications",
    useNavbar: "Switch to top navigation",
    useSidebar: "Switch to sidebar navigation",
    navigation: "Dashboard navigation",
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
    useNavbar: "Passer à la navigation supérieure",
    useSidebar: "Passer à la barre latérale",
    navigation: "Navigation du tableau de bord",
    unread: (count: number) =>
      `${count} notification${count > 1 ? "s" : ""} non lue${count > 1 ? "s" : ""}`,
    menuFor: (name: string) => `Menu du compte de ${name}`,
  },
});

interface TopbarProps {
  section: string;
  user: CurrentUser;
  collapsed: boolean;
  navigationMode: "sidebar" | "navbar";
  onToggleCollapsed: () => void;
  onNavigationModeChange: (mode: "sidebar" | "navbar") => void;
  onOpenMobile: () => void;
  onOpenSearch: () => void;
}

export function Topbar({
  section,
  user,
  collapsed,
  navigationMode,
  onToggleCollapsed,
  onNavigationModeChange,
  onOpenMobile,
  onOpenSearch,
}: TopbarProps) {
  const t = useMessages(messages);
  const nav = useMessages(navMessages);
  const roles = useMessages(roleMessages);
  const pathname = usePathname();
  const current = activeHref(pathname);
  const collapseLabel = collapsed ? t.expand : t.collapse;
  const layoutLabel = navigationMode === "sidebar" ? t.useNavbar : t.useSidebar;
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
    <header
      className={cn(
        "cg-topbar sticky top-0 z-20 shrink-0 overflow-hidden border-b border-border bg-card/95 shadow-[0_1px_0_rgba(16,24,40,.02)] backdrop-blur-xl",
        "transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        navigationMode === "navbar" ? "h-[58px] lg:h-[116px]" : "h-[58px]",
      )}
    >
      <div className="flex h-[58px] items-center gap-2 px-4 transition-[height] duration-300 sm:px-7 lg:h-[58px]">
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
                className={cn(
                  "hidden size-8 text-muted-foreground lg:inline-flex",
                  navigationMode === "navbar" && "lg:hidden",
                )}
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  onNavigationModeChange(
                    navigationMode === "sidebar" ? "navbar" : "sidebar",
                  )
                }
                aria-label={layoutLabel}
                className="hidden size-8 text-muted-foreground lg:inline-flex"
              >
                {navigationMode === "sidebar" ? (
                  <LayoutPanelTop className="size-[18px]" />
                ) : (
                  <LayoutPanelLeft className="size-[18px]" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{layoutLabel}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div
          aria-hidden="true"
          className={cn(
            "mx-1 hidden h-5 w-px bg-border lg:block",
            navigationMode === "navbar" && "lg:hidden",
          )}
        />

        <Link
          href="/dashboard"
          aria-label="CabinGuard"
          className={cn(
            "hidden items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex",
            navigationMode === "sidebar" && "lg:hidden",
          )}
        >
          <span className="grid size-9 place-items-center rounded-[10px] bg-primary text-primary-foreground shadow-[0_7px_18px_rgba(48,71,217,.22)]">
            <ShieldCheck className="size-[21px]" strokeWidth={2.1} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-[-0.025em]">
              CabinGuard
            </span>
            <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              {nav.sections.operations}
            </span>
          </span>
        </Link>

        <nav
          aria-label={t.breadcrumb}
          className={cn("min-w-0", navigationMode === "navbar" && "lg:hidden")}
        >
          <ol className="flex items-center gap-2 text-[13px]">
            <li className="hidden font-medium text-muted-foreground sm:block">
              CabinGuard
            </li>
            <li aria-hidden="true" className="hidden text-border sm:block">
              /
            </li>
            <li className="truncate font-semibold text-foreground">
              {section}
            </li>
          </ol>
        </nav>

        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={t.search}
          className="absolute left-1/2 hidden h-9 w-[min(420px,34vw)] -translate-x-1/2 items-center gap-2 rounded-[9px] border border-border bg-muted/70 px-3 text-left text-muted-foreground shadow-[0_1px_2px_rgba(16,24,40,.025)] outline-none transition hover:bg-card hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring xl:flex"
        >
          <Search className="size-[17px] shrink-0" />
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {t.searchPlaceholder}
          </span>
          <span className="flex items-center gap-0.5 rounded bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
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
            className="size-8 text-muted-foreground xl:hidden"
          >
            <Search className="size-[18px]" />
          </Button>
          <LanguageSwitch variant="console" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={unread === null ? t.notifications : t.unread(unread)}
            className="relative size-8 text-muted-foreground"
          >
            <Bell className="size-[18px]" />
            {unread !== null && unread > 0 ? (
              <span className="absolute top-2 right-2 size-1.5 rounded-full bg-[#f04438] ring-2 ring-white" />
            ) : null}
          </Button>
          <span className="h-6 w-px bg-border" />
          <Link
            href="/dashboard/profile"
            className="hidden h-11 items-center gap-2.5 rounded-xl px-1.5 text-left outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:flex"
            aria-label={t.menuFor(fullName(user))}
          >
            <span className="grid size-9 place-items-center rounded-full bg-[#465da1] text-[12px] font-bold text-white">
              {initials(user)}
            </span>
            <span className="hidden min-w-0 flex-col leading-tight lg:flex">
              <span className="max-w-[150px] truncate text-[12px] font-semibold text-foreground">
                {fullName(user)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {roles[user.role]}
              </span>
            </span>
          </Link>
        </div>
      </div>

      <nav
        aria-label={t.navigation}
        className={cn(
          "hidden border-t border-border/70 px-5 lg:flex lg:items-center lg:justify-center",
          "transition-[height,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          navigationMode === "navbar"
            ? "lg:h-[58px] lg:translate-y-0 lg:opacity-100"
            : "lg:pointer-events-none lg:h-0 lg:-translate-y-2 lg:opacity-0",
        )}
      >
        <ul className="cg-scroll flex max-w-full items-center gap-1 overflow-x-auto py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.href === current;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-9 items-center gap-2 rounded-[9px] px-3 text-[12px] font-medium outline-none transition-all duration-200",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-secondary font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(48,71,217,.08)]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 transition-transform duration-200 group-hover:-translate-y-px",
                      active && "text-primary",
                    )}
                    strokeWidth={1.9}
                  />
                  <span>{nav.items[item.key]}</span>
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-[10px] h-0.5 rounded-full bg-primary" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
