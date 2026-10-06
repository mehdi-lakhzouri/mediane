"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { LoaderCircle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Sidebar } from "../components/dashboard/sidebar";
import { Topbar } from "../components/dashboard/topbar";
import { ToastProvider } from "../components/dashboard/toast-provider";
import {
  destinationFor,
  getCurrentUser,
  type CurrentUser,
} from "../../lib/api/auth";
import { onSessionLost } from "../../lib/api/client";
import { navTitle } from "./nav";

const COLLAPSE_KEY = "cg.sidebar.collapsed";

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
  }, [pathname]);

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
        <span className="sr-only">Loading your dashboard</span>
      </div>
    );
  }

  return (
    // "user" honours the OS reduced-motion setting for every dashboard
    // animation: transforms are skipped, opacity fades remain.
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <div className="cg-dash min-h-svh bg-background">
          <Sidebar
            user={auth.user}
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />

          <div
            className={cn(
              "flex min-h-svh flex-col transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              collapsed ? "lg:pl-[72px]" : "lg:pl-[272px]",
            )}
          >
            <Topbar
              section={navTitle(pathname)}
              user={auth.user}
              collapsed={collapsed}
              onToggleCollapsed={toggleCollapsed}
              onOpenMobile={() => setMobileOpen(true)}
            />
            <main className="cg-scroll flex-1 px-4 py-6 sm:px-6 lg:px-9 lg:pt-6 lg:pb-3">
              <div className="mx-auto w-full max-w-[1360px]">{children}</div>
            </main>
          </div>
        </div>
      </ToastProvider>
    </MotionConfig>
  );
}
