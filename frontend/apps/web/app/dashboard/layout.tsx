"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { LoaderCircle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Sidebar } from "../components/dashboard/sidebar";
import { DashboardSearch } from "../components/dashboard/dashboard-search";
import { Topbar } from "../components/dashboard/topbar";
import { ToastProvider } from "../components/dashboard/toast-provider";
import {
  destinationFor,
  getCurrentUser,
  type CurrentUser,
} from "../../lib/api/auth";
import { onSessionLost } from "../../lib/api/client";
import { useMessages } from "../../lib/i18n/locale-provider";
import { defineMessages } from "../../lib/i18n/messages";
import { navKey, navMessages } from "./nav";

const messages = defineMessages({
  en: { loading: "Loading your dashboard" },
  fr: { loading: "Chargement de votre tableau de bord" },
});

const COLLAPSE_KEY = "cg.sidebar.collapsed";
type DashboardDensity = "comfortable" | "compact";

type AuthState =
  | { kind: "loading" }
  | { kind: "authenticated"; user: CurrentUser }
  | { kind: "unauthenticated" };

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function readDensity(): DashboardDensity {
  try {
    const saved = JSON.parse(
      localStorage.getItem("cg.dashboard-preferences") ?? "{}",
    ) as { density?: string };
    return saved.density === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useMessages(messages);
  const nav = useMessages(navMessages);
  const router = useRouter();
  const pathname = usePathname();
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [density, setDensity] = useState<DashboardDensity>("comfortable");

  // Server-side guards remain authoritative; this only avoids rendering the
  // shell for a visitor without a session (sent to sign in) or an
  // administrator who has not finished onboarding (sent to the missing step).
  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (!active) return;
        if (user.accountState !== "ACTIVE") {
          router.replace(destinationFor(user.accountState));
          return;
        }
        setAuth({ kind: "authenticated", user });
      })
      .catch(() => {
        if (active) setAuth({ kind: "unauthenticated" });
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    setCollapsed(readCollapsed());
    setDensity(readDensity());
  }, []);

  useEffect(() => {
    const updatePreferences = (event: Event) => {
      const next = (event as CustomEvent<{ density?: string }>).detail?.density;
      setDensity(next === "compact" ? "compact" : "comfortable");
    };
    window.addEventListener(
      "cabinguard:preferences-updated",
      updatePreferences,
    );
    return () =>
      window.removeEventListener(
        "cabinguard:preferences-updated",
        updatePreferences,
      );
  }, []);

  // Raised when a 401 could not be recovered by /auth/refresh.
  useEffect(
    () => onSessionLost(() => setAuth({ kind: "unauthenticated" })),
    [],
  );

  useEffect(() => {
    if (auth.kind === "unauthenticated") router.replace("/sign-in");
  }, [auth.kind, router]);

  useEffect(() => {
    const updateUser = (event: Event) => {
      const user = (event as CustomEvent<CurrentUser>).detail;
      if (user) setAuth({ kind: "authenticated", user });
    };
    window.addEventListener("cabinguard:user-updated", updateUser);
    return () =>
      window.removeEventListener("cabinguard:user-updated", updateUser);
  }, []);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // Collapse state is a convenience only.
      }
      return next;
    });
  }, []);

  if (auth.kind !== "authenticated") {
    return (
      <div className="cg-dash grid min-h-svh place-items-center bg-background">
        <LoaderCircle className="size-6 animate-spin text-primary" />
        <span className="sr-only">{t.loading}</span>
      </div>
    );
  }

  return (
    // "user" honours the OS reduced-motion setting for every dashboard
    // animation: transforms are skipped, opacity fades remain.
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <div
          data-density={density}
          className={cn(
            "cg-dash min-h-svh bg-background",
            density === "compact" &&
              "[&_[data-slot=table-cell]]:py-2 [&_[data-slot=card-content]]:p-4",
          )}
        >
          <Sidebar
            user={auth.user}
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
            onOpenSearch={() => {
              setMobileOpen(false);
              setSearchOpen(true);
            }}
          />

          <div
            className={cn(
              "flex min-h-svh min-w-0 flex-col transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              collapsed ? "lg:pl-[72px]" : "lg:pl-[272px]",
            )}
          >
            <Topbar
              section={nav.items[navKey(pathname)]}
              user={auth.user}
              collapsed={collapsed}
              onToggleCollapsed={toggleCollapsed}
              onOpenMobile={() => setMobileOpen(true)}
              onOpenSearch={() => setSearchOpen(true)}
            />
            <main
              className={cn(
                "cg-scroll min-w-0 flex-1 px-4 sm:px-6 lg:px-9 lg:pb-3",
                density === "compact" ? "py-4 lg:pt-4" : "py-6 lg:pt-6",
              )}
            >
              <div className="mx-auto w-full min-w-0 max-w-[1360px]">
                {children}
              </div>
            </main>
          </div>
          <DashboardSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </div>
      </ToastProvider>
    </MotionConfig>
  );
}
