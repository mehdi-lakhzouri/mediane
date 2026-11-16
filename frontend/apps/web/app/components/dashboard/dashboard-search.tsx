"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  KeyRound,
  Search,
  Settings2,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { cn } from "@repo/ui/lib/utils";
import { NAV_ITEMS, navMessages } from "../../dashboard/nav";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";
import { MedianeMark } from "../mediane-brand";

const messages = defineMessages({
  en: {
    title: "Search Mediane",
    description: "Jump to a dashboard page or setting.",
    placeholder: "Search users, families, security…",
    navigation: "Dashboard",
    settings: "Settings",
    profile: "Your profile",
    profileDescription: "Identity, account details and signed-in devices",
    general: "General settings",
    generalDescription: "Account, password and quick actions",
    security: "Security and MFA",
    securityDescription: "Authenticator, recovery codes and account protection",
    team: "Team access",
    teamDescription: "Review administrators and drivers",
    notifications: "Notification preferences",
    notificationsDescription: "Choose how Mediane keeps you informed",
    preferences: "Dashboard preferences",
    preferencesDescription: "Language, timezone and interface density",
    empty: "No result found",
    emptyHint: "Try a page name or a setting such as security.",
    open: "Open",
    move: "Move",
    close: "Close",
  },
  fr: {
    title: "Rechercher dans Mediane",
    description: "Accédez rapidement à une page ou à un réglage.",
    placeholder: "Rechercher utilisateurs, familles, sécurité…",
    navigation: "Tableau de bord",
    settings: "Paramètres",
    profile: "Votre profil",
    profileDescription: "Identité, détails du compte et appareils connectés",
    general: "Paramètres généraux",
    generalDescription: "Compte, mot de passe et actions rapides",
    security: "Sécurité et MFA",
    securityDescription:
      "Authentificateur, codes de récupération et protection",
    team: "Accès de l’équipe",
    teamDescription: "Consultez les administrateurs et conducteurs",
    notifications: "Préférences de notification",
    notificationsDescription: "Choisissez comment Mediane vous informe",
    preferences: "Préférences du tableau de bord",
    preferencesDescription: "Langue, fuseau horaire et densité de l’interface",
    empty: "Aucun résultat",
    emptyHint: "Essayez le nom d’une page ou un réglage comme sécurité.",
    open: "Ouvrir",
    move: "Naviguer",
    close: "Fermer",
  },
});

interface SearchItem {
  id: string;
  label: string;
  description: string;
  href: string;
  group: string;
  icon: ComponentType<{ className?: string }>;
  keywords: string;
}

export function DashboardSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useMessages(messages);
  const nav = useMessages(navMessages);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo<SearchItem[]>(
    () => [
      ...NAV_ITEMS.map((item) => ({
        id: item.key,
        label: nav.items[item.key],
        description:
          nav.sections[
            item.key === "health" || item.key === "incidents"
              ? "safety"
              : item.key === "audit" || item.key === "settings"
                ? "system"
                : "operations"
          ],
        href: item.href,
        group: t.navigation,
        icon: item.icon,
        keywords: `${item.key} ${item.href}`,
      })),
      {
        id: "profile",
        label: t.profile,
        description: t.profileDescription,
        href: "/dashboard/profile",
        group: t.navigation,
        icon: UserRound,
        keywords:
          "profile account identity devices profil compte identité appareils",
      },
      {
        id: "settings-general",
        label: t.general,
        description: t.generalDescription,
        href: "/dashboard/settings#general",
        group: t.settings,
        icon: Settings2,
        keywords: "general account password compte mot de passe général",
      },
      {
        id: "settings-security",
        label: t.security,
        description: t.securityDescription,
        href: "/dashboard/settings#security",
        group: t.settings,
        icon: KeyRound,
        keywords:
          "security mfa authenticator recovery codes sécurité authentificateur récupération",
      },
      {
        id: "settings-team",
        label: t.team,
        description: t.teamDescription,
        href: "/dashboard/settings#team",
        group: t.settings,
        icon: Users,
        keywords: "team users access équipe utilisateurs accès",
      },
      {
        id: "settings-notifications",
        label: t.notifications,
        description: t.notificationsDescription,
        href: "/dashboard/settings#notifications",
        group: t.settings,
        icon: Bell,
        keywords: "notifications alerts email push alertes",
      },
      {
        id: "settings-preferences",
        label: t.preferences,
        description: t.preferencesDescription,
        href: "/dashboard/settings#preferences",
        group: t.settings,
        icon: SlidersHorizontal,
        keywords:
          "preferences language timezone density langue fuseau densité flags drapeaux",
      },
    ],
    [nav, t],
  );

  const results = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return items.slice(0, 10);
    return items
      .filter((item) =>
        normalize(
          `${item.label} ${item.description} ${item.keywords}`,
        ).includes(needle),
      )
      .slice(0, 10);
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  function select(item: SearchItem) {
    onOpenChange(false);
    router.push(item.href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[12vh] max-w-[680px] translate-y-0 rounded-2xl border-[#dbe3ef] shadow-[0_28px_90px_rgba(15,30,70,.28)]"
        overlayClassName="bg-[#101828]/45 backdrop-blur-[2px]"
        closeClassName="top-5 right-5"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="flex h-16 items-center gap-3 border-b border-border px-5 pr-16">
          <Search className="size-5 shrink-0 text-primary" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder={t.placeholder}
            aria-label={t.title}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:text-muted-foreground"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) =>
                  results.length ? (index + 1) % results.length : 0,
                );
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) =>
                  results.length
                    ? (index - 1 + results.length) % results.length
                    : 0,
                );
              }
              if (event.key === "Enter" && results[activeIndex]) {
                event.preventDefault();
                select(results[activeIndex]);
              }
            }}
          />
          <kbd className="hidden rounded-md border border-border bg-muted px-2 py-1 font-sans text-[10px] font-semibold text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        <div className="cg-scroll max-h-[min(480px,62vh)] overflow-y-auto p-2.5">
          {results.length ? (
            <div role="listbox" aria-label={t.title}>
              {results.map((item, index) => {
                const Icon = item.icon;
                const active = index === activeIndex;
                const firstInGroup =
                  index === 0 || results[index - 1]?.group !== item.group;
                return (
                  <div key={item.id}>
                    {firstInGroup && (
                      <p className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground first:pt-1">
                        {item.group}
                      </p>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(item)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left outline-none transition",
                        active
                          ? "bg-secondary text-secondary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm",
                          active && "border-primary/15 text-primary",
                        )}
                      >
                        <Icon className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-foreground">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {item.description}
                        </span>
                      </span>
                      <ArrowRight
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground opacity-0 transition",
                          active && "translate-x-0.5 text-primary opacity-100",
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Search className="size-5" />
              </span>
              <p className="mt-4 text-sm font-bold">{t.empty}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {t.emptyHint}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border bg-muted/35 px-5 py-2.5 text-[10px] font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5">
              ↑↓
            </kbd>
            {t.move}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5">
              ↵
            </kbd>
            {t.open}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <MedianeMark size={16} /> Mediane
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
