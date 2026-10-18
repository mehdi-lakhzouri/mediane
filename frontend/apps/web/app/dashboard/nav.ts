import {
  ClipboardList,
  HeartHandshake,
  HeartPulse,
  LayoutDashboard,
  MailPlus,
  Settings,
  Siren,
  Users,
  type LucideIcon,
} from "lucide-react";
import { defineMessages } from "../../lib/i18n/messages";

export type NavKey =
  | "overview"
  | "users"
  | "families"
  | "invitations"
  | "health"
  | "incidents"
  | "audit"
  | "profile"
  | "settings";

type SectionKey = "operations" | "safety" | "system";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  key: SectionKey;
  items: NavItem[];
}

/** Labels for the navigation, the breadcrumb and page titles. */
export const navMessages = defineMessages({
  en: {
    sections: {
      operations: "Operations",
      safety: "Safety",
      system: "System",
    } satisfies Record<SectionKey, string>,
    items: {
      overview: "Overview",
      users: "Users",
      families: "Families",
      invitations: "Invitations",
      health: "Health",
      incidents: "Incidents",
      audit: "Audit log",
      profile: "Profile",
      settings: "Settings",
    } satisfies Record<NavKey, string>,
  },
  fr: {
    sections: {
      operations: "Opérations",
      safety: "Sécurité routière",
      system: "Système",
    },
    items: {
      overview: "Vue d’ensemble",
      users: "Utilisateurs",
      families: "Familles",
      invitations: "Invitations",
      health: "Santé",
      incidents: "Incidents",
      audit: "Journal d’audit",
      profile: "Profil",
      settings: "Paramètres",
    },
  },
});

/** Single source of truth for the dashboard navigation. */
export const NAV_SECTIONS: NavSection[] = [
  {
    key: "operations",
    items: [
      { key: "overview", href: "/dashboard", icon: LayoutDashboard },
      { key: "users", href: "/dashboard/drivers", icon: Users },
      { key: "families", href: "/dashboard/families", icon: HeartHandshake },
      { key: "invitations", href: "/dashboard/invitations", icon: MailPlus },
    ],
  },
  {
    key: "safety",
    items: [
      { key: "health", href: "/dashboard/health", icon: HeartPulse },
      { key: "incidents", href: "/dashboard/incidents", icon: Siren },
    ],
  },
  {
    key: "system",
    items: [
      { key: "audit", href: "/dashboard/audit", icon: ClipboardList },
      { key: "settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);

/** Longest matching href wins so nested routes keep their parent highlighted. */
export function activeHref(pathname: string): string {
  if (pathname === "/dashboard/profile") return pathname;
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

export function navKey(pathname: string): NavKey {
  if (pathname === "/dashboard/profile") return "profile";
  const href = activeHref(pathname);
  return NAV_ITEMS.find((item) => item.href === href)?.key ?? "overview";
}
