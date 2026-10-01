"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, X } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { activeHref, NAV_SECTIONS, type NavItem } from "../../dashboard/nav";
import type { CurrentUser } from "../../../lib/api/auth";
import { UserMenu } from "./user-menu";

interface SidebarProps {
  user: CurrentUser;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  user,
  collapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const current = activeHref(usePathname());

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
              Admin console
            </span>
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="ml-auto grid size-9 place-items-center rounded-lg text-sidebar-muted outline-none transition-colors hover:bg-sidebar-hover hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 px-[15px] pt-3 pb-2">
          {NAV_SECTIONS.map((section) => (
            <div
              key={section.title}
              className={cn("mb-6", collapsed && "lg:mb-3")}
            >
              <p
                className={cn(
                  "px-2.5 pb-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sidebar-muted",
                  collapsed && "lg:sr-only",
                )}
              >
                {section.title}
              </p>
              <ul className="flex flex-col gap-1.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
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
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
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
        "flex h-12 items-center gap-3 rounded-[11px] px-3.5 text-[14px] font-medium outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-white/70",
        active
          ? "bg-sidebar-active text-sidebar-active-foreground"
          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground",
        collapsed && "lg:justify-center lg:px-0",
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.9} />
      <span className={cn("truncate", collapsed && "lg:hidden")}>
        {item.label}
      </span>
    </Link>
  );

  // The label is hidden when collapsed, so the tooltip carries it instead.
  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
