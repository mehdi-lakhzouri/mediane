"use client";

import { Bell, Menu, PanelLeft, PanelLeftClose, Search } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";

interface TopbarProps {
  section: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
}

export function Topbar({
  section,
  collapsed,
  onToggleCollapsed,
  onOpenMobile,
}: TopbarProps) {
  const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <header className="cg-topbar sticky top-0 z-20 flex h-[64px] shrink-0 items-center gap-2 border-b border-border bg-card px-4 transition-[padding] duration-200 sm:px-8">
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
              className="hidden text-muted-foreground lg:inline-flex"
            >
              {collapsed ? <PanelLeft /> : <PanelLeftClose />}
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

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Search"
          className="text-[#526180]"
        >
          <Search className="size-[18px]" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative text-[#526180]"
        >
          <Bell className="size-[18px]" />
          <span className="absolute top-2 right-2 size-1.5 rounded-full bg-[#f04438] ring-2 ring-white" />
        </Button>
      </div>
    </header>
  );
}
