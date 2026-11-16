"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MoonStar, SunMedium } from "lucide-react";
import { useMessages } from "../../lib/i18n/locale-provider";
import { defineMessages } from "../../lib/i18n/messages";

const messages = defineMessages({
  en: { toLight: "Switch to light mode", toDark: "Switch to dark mode" },
  fr: { toLight: "Passer en mode clair", toDark: "Passer en mode sombre" },
});

export const THEME_STORAGE_KEY = "cg.signin.theme";
type Theme = "light" | "dark";

// useLayoutEffect warns when it runs during SSR; this file is "use client" but
// Next still renders it once on the server for the initial HTML.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

const iconVariants = {
  initial: { opacity: 0, rotate: -90, scale: 0.5 },
  animate: {
    opacity: 1,
    rotate: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 220, damping: 16 },
  },
  exit: {
    opacity: 0,
    rotate: 90,
    scale: 0.5,
    transition: { duration: 0.15, ease: "easeIn" as const },
  },
};

/**
 * Light/dark switch for the auth screens. Reads and writes `data-theme` on
 * <html>; a `beforeInteractive` script in the root layout applies the saved
 * preference before first paint, so this component's own default ("dark")
 * always matches what the server rendered — no hydration mismatch, and the
 * sync in the layout effect below resolves before the browser paints.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const reduceMotion = useReducedMotion();
  const t = useMessages(messages);

  useIsoLayoutEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Private browsing / storage disabled: fall back to dark, no persistence.
    }
    const initial: Theme = stored === "light" ? "light" : "dark";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggle(): void {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Preference just won't persist across visits; the toggle still works now.
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? t.toLight : t.toDark}
      title={isDark ? t.toLight : t.toDark}
      className="fixed top-4 right-4 z-30 grid size-11 shrink-0 place-items-center rounded-full border transition-colors duration-300 hover:bg-[var(--sx-icon-hover-bg)] focus-visible:ring-2 focus-visible:ring-[#30b5ff] focus-visible:ring-offset-2 focus-visible:outline-none sm:top-6 sm:right-6"
      style={{
        borderColor: "var(--sx-border)",
        background: "var(--sx-input-bg)",
        color: "var(--sx-icon-muted)",
        backdropFilter: "blur(14px)",
      }}
    >
      {reduceMotion ? (
        isDark ? (
          <MoonStar className="size-5" strokeWidth={1.8} />
        ) : (
          <SunMedium className="size-5" strokeWidth={1.8} />
        )
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDark ? "moon" : "sun"}
            variants={iconVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex items-center justify-center"
          >
            {isDark ? (
              <MoonStar className="size-5" strokeWidth={1.8} />
            ) : (
              <SunMedium className="size-5" strokeWidth={1.8} />
            )}
          </motion.span>
        </AnimatePresence>
      )}
    </button>
  );
}
