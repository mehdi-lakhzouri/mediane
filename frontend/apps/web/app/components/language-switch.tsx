"use client";

import { FR, GB } from "country-flag-icons/react/3x2";
import { cn } from "@repo/ui/lib/utils";
import { LOCALE_NAMES, LOCALES } from "../../lib/i18n/config";
import { defineMessages } from "../../lib/i18n/messages";
import {
  useChangeLocale,
  useLocale,
  useMessages,
} from "../../lib/i18n/locale-provider";

const messages = defineMessages({
  en: { label: "Language" },
  fr: { label: "Langue" },
});

type Variant = "auth" | "mfa" | "console" | "marketing";

const FRAME: Record<Variant, string> = {
  // Pinned left of the sign-in ThemeToggle: same height, same glass surface.
  auth: "fixed top-4 right-[68px] z-30 h-11 rounded-full border p-1 backdrop-blur-[14px] border-[var(--sx-border)] bg-[var(--sx-input-bg)] sm:top-6 sm:right-[76px]",
  mfa: "h-7 rounded-[7px] border border-[rgba(109,189,239,0.38)] bg-[rgba(3,21,39,0.5)] p-0.5",
  console: "h-8 rounded-[7px] border border-border bg-muted/60 p-0.5",
  marketing:
    "h-[44px] rounded-full border border-[var(--lp-line-strong)] bg-white/80 p-1",
};

const OPTION: Record<Variant, { base: string; active: string; idle: string }> =
  {
    auth: {
      base: "min-w-9 gap-1 rounded-full px-2 text-[12px] font-bold",
      active: "bg-[var(--sx-icon-hover-bg)] text-[var(--sx-icon-hover-fg)]",
      idle: "text-[var(--sx-icon-muted)] hover:text-[var(--sx-icon-hover-fg)]",
    },
    mfa: {
      base: "min-w-7 gap-1 rounded-[5px] px-1.5 text-[10px] font-extrabold",
      active: "bg-[#29c8ff] text-[#031527]",
      idle: "text-[#bbcade] hover:text-white",
    },
    console: {
      base: "min-w-8 gap-1 rounded-[5px] px-1.5 text-[11px] font-semibold",
      active: "bg-card text-foreground shadow-sm",
      idle: "text-muted-foreground hover:text-foreground",
    },
    marketing: {
      base: "min-w-9 gap-1 rounded-full px-2.5 text-[13px] font-semibold",
      active: "bg-[var(--lp-blue)] text-white",
      idle: "text-[var(--lp-ink-soft)] hover:text-[var(--lp-blue)]",
    },
  };

/**
 * EN / FR segmented switch. Saves the choice in a cookie and re-renders the
 * page in place; URLs never change with the language.
 */
export function LanguageSwitch({
  variant = "console",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const locale = useLocale();
  const t = useMessages(messages);
  const { changeLocale, pending } = useChangeLocale();
  const option = OPTION[variant];

  return (
    <div
      role="group"
      aria-label={t.label}
      aria-busy={pending}
      className={cn(
        "inline-flex shrink-0 items-stretch gap-0.5 transition-opacity",
        FRAME[variant],
        pending && "opacity-70",
        className,
      )}
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        const Flag = code === "en" ? GB : FR;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            title={LOCALE_NAMES[code]}
            onClick={() => !active && changeLocale(code)}
            className={cn(
              "inline-flex items-center justify-center uppercase transition-colors focus-visible:ring-2 focus-visible:ring-[#30b5ff] focus-visible:outline-none",
              option.base,
              active ? option.active : option.idle,
            )}
          >
            <Flag
              aria-hidden="true"
              className="h-3.5 w-5 rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(15,23,42,.12)]"
            />
            <span aria-hidden="true" className="hidden xl:inline">
              {code}
            </span>
            <span className="sr-only">{LOCALE_NAMES[code]}</span>
          </button>
        );
      })}
    </div>
  );
}

const toggleMessages = defineMessages({
  en: { switchTo: (language: string) => `Switch to ${language}` },
  fr: { switchTo: (language: string) => `Passer en ${language}` },
});

/**
 * One round button showing the current language; a press moves to the next
 * one. For crowded headers where the segmented switch does not fit.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useMessages(toggleMessages);
  const { changeLocale, pending } = useChangeLocale();
  const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length]!;

  return (
    <button
      type="button"
      onClick={() => changeLocale(next)}
      aria-busy={pending}
      aria-label={t.switchTo(LOCALE_NAMES[next])}
      title={t.switchTo(LOCALE_NAMES[next])}
      className={cn(
        "grid size-[44px] shrink-0 place-items-center rounded-full border border-[var(--lp-line-strong)] bg-white/80 text-[13px] font-semibold uppercase text-[var(--lp-ink-soft)] transition-colors hover:border-[var(--lp-blue-line)] hover:text-[var(--lp-blue)] focus-visible:ring-2 focus-visible:ring-[#30b5ff] focus-visible:outline-none",
        pending && "opacity-70",
        className,
      )}
    >
      {locale}
    </button>
  );
}
