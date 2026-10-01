import {
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  MailPlus,
  Settings,
  Siren,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Single source of truth for the dashboard navigation. */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Operations",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { label: "Users", href: "/dashboard/drivers", icon: Users },
      { label: "Invitations", href: "/dashboard/invitations", icon: MailPlus },
    ],
  },
  {
    title: "Safety",
    items: [
      { label: "Health", href: "/dashboard/health", icon: HeartPulse },
      { label: "Incidents", href: "/dashboard/incidents", icon: Siren },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Audit log", href: "/dashboard/audit", icon: ClipboardList },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);

/** Longest matching href wins so nested routes keep their parent highlighted. */
export function activeHref(pathname: string): string {
  return (
    NAV_ITEMS.map((item) => item.href)
      .filter(
        (href) =>
          pathname === href ||
          (href !== "/dashboard" && pathname.startsWith(`${href}/`)),
      )
      .sort((a, b) => b.length - a.length)[0] ?? "/dashboard"
  );
}

export function navTitle(pathname: string): string {
  const href = activeHref(pathname);
  return NAV_ITEMS.find((item) => item.href === href)?.label ?? "Overview";
}
