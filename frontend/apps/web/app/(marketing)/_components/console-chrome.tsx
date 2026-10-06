import {
  Bell,
  Calendar,
  ChartColumn,
  ChevronDown,
  HeartPulse,
  LayoutGrid,
  Mail,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { ShieldMark } from "./icons";

/**
 * Shared frame of the console mocks: navy sidebar, search bar and account
 * chip, drawn at design pixels (the parent ScaledCanvas scales them).
 */
export type ConsoleNavItem = {
  label: string;
  icon: typeof Users;
  divider?: boolean;
};

export const OVERVIEW_NAV: ConsoleNavItem[] = [
  { label: "Overview", icon: LayoutGrid },
  { label: "Drivers", icon: UserRound },
  { label: "Families", icon: Users, divider: true },
  { label: "Incidents", icon: ShieldCheck, divider: true },
  { label: "Invitations", icon: Mail, divider: true },
  { label: "Health", icon: HeartPulse },
  { label: "Analytics", icon: ChartColumn },
  { label: "Settings", icon: Settings },
];

export function ConsoleSidebar({
  items,
  width = 112,
  gap = 40,
  active: activeLabel,
  brand = true,
  className = "inset-y-0",
}: {
  items: ConsoleNavItem[];
  width?: number;
  gap?: number;
  /** Label of the highlighted item; the first item when omitted. */
  active?: string;
  /** Whether the sidebar carries the CabinGuard mark at its top. */
  brand?: boolean;
  className?: string;
}) {
  return (
    <aside
      className={`lp-console-sidebar absolute left-0 flex flex-col px-2.5 pt-6 text-white ${className}`}
      style={{ width }}
    >
      {brand ? (
        <div className="mb-7 flex items-center gap-1.5 px-0.5">
          <ShieldMark size={18} className="flex-none" />
          <span className="whitespace-nowrap text-[12.5px] font-bold tracking-[-0.02em]">
            CabinGuard
          </span>
        </div>
      ) : null}
      <nav className="flex flex-col">
        {items.map((item, index) => {
          const active = activeLabel ? item.label === activeLabel : index === 0;
          const ItemIcon = item.icon;
          return (
            <div key={item.label}>
              <div
                className={`flex items-center gap-1.5 rounded-[10px] px-1.5 text-[11.5px] font-medium transition-colors duration-300 ${
                  active
                    ? "bg-white text-[#1d4fd8] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.35)]"
                    : "text-white/88"
                }`}
                style={{ height: 34, marginBottom: gap - 34 }}
              >
                <ItemIcon size={15} strokeWidth={2} className="flex-none" />
                <span className="truncate">{item.label}</span>
              </div>
              {item.divider ? (
                <div className="mx-2 -mt-1 mb-2 h-px bg-white/12" />
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
export function ConsoleTopBar({ name = "Mahdi Lakhzouri" }: { name?: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-[34px] w-[330px] items-center gap-2 rounded-full border border-[#e6edf8] bg-white/90 px-3.5 text-[11.5px] text-[#8b98b1]">
        <Search size={14} strokeWidth={2} className="text-[#56647f]" />
        Search drivers, families, incidents, or settings...
      </div>
      <div className="ml-auto flex items-center gap-4">
        <span className="relative text-[#3b4a6b]">
          <Bell size={19} strokeWidth={1.8} />
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-white bg-[#ef2d35]" />
        </span>
        <span className="grid size-[34px] place-items-center rounded-full bg-[#2a4697] text-[12px] font-bold text-white">
          ML
        </span>
        <span className="leading-tight">
          <span className="block text-[12.5px] font-bold text-[#0f1a3a]">
            {name}
          </span>
          <span className="block text-[10.5px] text-[#7a87a3]">
            Administrator
          </span>
        </span>
        <ChevronDown size={15} className="text-[#3b4a6b]" />
      </div>
    </div>
  );
}
export function RangePill({ label = "Last 30 days" }: { label?: string }) {
  return (
    <div className="flex h-[32px] items-center gap-2 rounded-[10px] border border-[#e3eaf6] bg-white px-3 text-[11.5px] font-medium text-[#1a2547] shadow-[0_6px_14px_-10px_rgba(16,40,94,0.3)]">
      <Calendar size={13} strokeWidth={2} />
      {label}
      <ChevronDown size={13} className="ml-3" />
    </div>
  );
}

export function StatPanel({
  icon,
  tone = "blue",
  label,
  value,
  delta,
  trend,
  good,
  note,
  children,
}: {
  icon: ReactNode;
  tone?: "blue" | "red";
  label: string;
  value: ReactNode;
  delta: string;
  trend: "up" | "down";
  /** Whether this change is good news (green) or bad news (red). */
  good: boolean;
  note: string;
  children: ReactNode;
}) {
  return (
    <div className="lp-panel relative flex flex-col p-3">
      <div className="flex items-center gap-2">
        <span
          className={`lp-tile size-[30px] rounded-[9px] ${tone === "red" ? "lp-tile-red" : ""}`}
        >
          {icon}
        </span>
        <span className="text-[12px] font-semibold text-[#14203f]">
          {label}
        </span>
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className="text-[24px] font-extrabold leading-none tracking-[-0.03em] text-[#0b1533]">
          {value}
        </span>
        <span className="mb-1">{children}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[#7a87a3]">
        <span
          className={`lp-pill text-[10.5px] ${good ? "lp-pill-green" : "lp-pill-red"}`}
        >
          {trend === "up" ? "↑" : "↓"} {delta}
        </span>
        {note}
      </div>
    </div>
  );
}
