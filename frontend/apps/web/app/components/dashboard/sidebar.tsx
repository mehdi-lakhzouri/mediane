"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ShieldCheck, X } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import {
  activeHref,
  NAV_SECTIONS,
  navMessages,
  type NavItem,
} from "../../dashboard/nav";
import type { CurrentUser } from "../../../lib/api/auth";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";
import { UserMenu } from "./user-menu";

const messages = defineMessages({
  en: {
    console: "Admin console",
    close: "Close menu",
    search: "Search dashboard",
  },
  fr: {
    console: "Console d’administration",
    close: "Fermer le menu",
    search: "Rechercher",
  },
});

interface SidebarProps {
  user: CurrentUser;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSearch: () => void;
}

export function Sidebar({
  user,
  collapsed,
  mobileOpen,
  onCloseMobile,
  onOpenSearch,
}: SidebarProps) {
  const current = activeHref(usePathname());
  const t = useMessages(messages);
  const nav = useMessages(navMessages);

  return (
    <TooltipProvider delayDuration={120}>
      {/* Scrim, mobile only */}
      <div
        aria-hidden="true"
        onClick={onCloseMobile}
        className={cn(
          "fixed inset-0 z-30 bg-foreground/25 transition-opacity duration-200 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "cg-scroll-invert fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col overflow-y-auto overflow-x-hidden bg-sidebar text-sidebar-foreground before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_-10%_45%,rgba(65,91,196,.28),transparent_48%)]",
          "transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-x-0",
          collapsed ? "lg:w-[72px]" : "lg:w-[272px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "relative flex h-[76px] shrink-0 items-center gap-3 px-[18px]",
            collapsed && "lg:justify-center lg:px-0",
          )}
        >
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            aria-label="CabinGuard"
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white/70",
              collapsed && "lg:justify-center",
            )}
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#4058d4] shadow-[0_8px_20px_rgba(10,22,83,.2)] ring-1 ring-white/10">
              <ShieldCheck className="size-7 text-white" strokeWidth={2} />
            </span>
            <span
              className={cn(
                "flex min-w-0 flex-col leading-[1.25]",
                collapsed && "lg:hidden",
              )}
            >
              <span className="truncate text-[17px] font-bold tracking-[-0.02em]">
                CabinGuard
              </span>
              <span className="truncate text-[12px] font-medium text-sidebar-muted">
                {t.console}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label={t.close}
            className="ml-auto grid size-9 place-items-center rounded-lg text-sidebar-muted outline-none transition-colors hover:bg-sidebar-hover hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className={cn("relative px-[15px] pb-2", collapsed && "lg:px-3")}>
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={t.search}
            className={cn(
              "flex h-11 w-full items-center gap-3 rounded-[11px] border border-white/10 bg-white/[0.07] px-3 text-left text-sidebar-muted outline-none transition hover:border-white/20 hover:bg-white/[0.12] hover:text-white focus-visible:ring-2 focus-visible:ring-white/70",
              collapsed && "lg:justify-center lg:px-0",
            )}
          >
            <Search className="size-[18px] shrink-0" />
            <span className={cn("min-w-0 flex-1 truncate text-[12px] font-medium", collapsed && "lg:hidden")}>
              {t.search}
            </span>
            <kbd
              className={cn(
                "flex items-center gap-0.5 rounded-md border border-white/10 bg-black/10 px-1.5 py-0.5 font-sans text-[9px] font-semibold text-sidebar-muted",
                collapsed && "lg:hidden",
              )}
            >
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 px-[15px] pt-2 pb-2">
          {NAV_SECTIONS.map((section) => (
            <div
              key={section.key}
              className={cn("mb-6", collapsed && "lg:mb-3")}
            >
              <p
                className={cn(
                  "px-2.5 pb-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sidebar-muted",
                  collapsed && "lg:sr-only",
                )}
              >
                {nav.sections[section.key]}
              </p>
              <ul className="flex flex-col gap-1.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      label={nav.items[item.key]}
                      active={item.href === current}
                      collapsed={collapsed}
                      onNavigate={onCloseMobile}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Account */}
        <div className="relative mt-auto shrink-0 border-t border-sidebar-border p-3.5">
          <UserMenu user={user} collapsed={collapsed} />
        </div>
      </aside>
    </TooltipProvider>
  );
}

function NavLink({
  item,
  label,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  label: string;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 items-center gap-3 overflow-hidden rounded-[11px] px-3.5 text-[13px] font-medium outline-none transition-all",
        "focus-visible:ring-2 focus-visible:ring-white/70",
        active
          ? "bg-sidebar-active font-semibold text-sidebar-active-foreground shadow-[0_5px_18px_rgba(9,21,78,.14)]"
          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground",
        collapsed && "lg:justify-center lg:px-0",
      )}
    >
      {active && (
        <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" />
      )}
      <Icon
        className={cn(
          "size-[19px] shrink-0 transition-transform group-hover:scale-105",
          active && "text-primary",
        )}
        strokeWidth={1.9}
      />
      <span className={cn("truncate", collapsed && "lg:hidden")}>{label}</span>
    </Link>
  );

  // The label is hidden when collapsed, so the tooltip carries it instead.
  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
