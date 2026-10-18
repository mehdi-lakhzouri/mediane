"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  INTL_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "./config";
import type { Messages } from "./messages";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Set once in the root layout from the request's locale. */
export function LocaleProvider({
  locale,
  children,
}: Readonly<{ locale: Locale; children: ReactNode }>) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** The active locale's copy from a `defineMessages` tree. */
export function useMessages<T>(messages: Messages<T>): T {
  return messages[useLocale()];
}

/**
 * Saves the reader's choice and re-renders the current page in it. Client
 * state (open sheets, typed text) survives: only server output is refreshed.
 */
export function useChangeLocale(): {
  changeLocale: (next: Locale) => void;
  pending: boolean;
} {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const changeLocale = useCallback(
    (next: Locale) => {
      const secure = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${secure}`;
      document.documentElement.lang = next;
      startTransition(() => router.refresh());
    },
    [router],
  );

  return { changeLocale, pending };
}

const NEVER: Record<Locale, string> = { en: "Never", fr: "Jamais" };

export interface Formatters {
  /** "7 Oct 2026, 14:05" / "7 oct. 2026, 14:05"; "Never" when missing. */
  dateTime: (value: string | Date | null, missing?: string) => string;
  /** "7 Oct 2026" / "7 oct. 2026"; an em dash when missing. */
  date: (value: string | Date | null) => string;
  /** "1,234" / "1 234". */
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** "3 minutes ago" / "il y a 3 minutes", picking the largest fitting unit. */
  ago: (value: string | Date) => string;
  /** "Ana, Ben and Chloé" / "Ana, Ben et Chloé". */
  list: (items: string[]) => string;
}

const AGO_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** Locale-aware Intl formatters, built once per locale. */
export function useFormatters(): Formatters {
  const locale = useLocale();
  return useMemo(() => {
    const tag = INTL_LOCALE[locale];
    const dateTimeFormat = new Intl.DateTimeFormat(tag, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const dateFormat = new Intl.DateTimeFormat(tag, { dateStyle: "medium" });
    const relativeFormat = new Intl.RelativeTimeFormat(tag, {
      numeric: "auto",
    });
    const listFormat = new Intl.ListFormat(tag, {
      style: "long",
      type: "conjunction",
    });
    return {
      dateTime: (value, missing = NEVER[locale]) =>
        value ? dateTimeFormat.format(new Date(value)) : missing,
      date: (value) => (value ? dateFormat.format(new Date(value)) : "—"),
      number: (value, options) =>
        new Intl.NumberFormat(tag, options).format(value),
      ago: (value) => {
        const seconds = Math.max(
          0,
          Math.floor((Date.now() - new Date(value).getTime()) / 1000),
        );
        const fit = AGO_UNITS.find(([, size]) => seconds >= size);
        // Under a minute: "now" / "maintenant".
        if (!fit) return relativeFormat.format(0, "second");
        const [unit, size] = fit;
        return relativeFormat.format(-Math.floor(seconds / size), unit);
      },
      list: (items) => listFormat.format(items),
    };
  }, [locale]);
}
