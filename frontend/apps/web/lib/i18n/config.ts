/**
 * Locales the web app ships in. The active one lives in the `cg.locale`
 * cookie (set by the language switcher); without it, the browser's
 * Accept-Language decides. URLs stay the same in every language, so links in
 * emails and bookmarks keep working whatever the reader's language.
 */
export const LOCALES = ["en", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "cg.locale";

/** One year: the choice is a preference, not a session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Regional variants used by Intl formatters (dates, numbers). */
export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  fr: "fr-FR",
};

/** Names shown in the language switcher, each in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}

/**
 * Picks the best supported locale from an Accept-Language header, honouring
 * q-values ("fr-CA,fr;q=0.9,en;q=0.8" -> "fr").
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      return {
        language: tag.toLowerCase().split("-")[0],
        weight: q ? Number(q.slice(2)) || 0 : 1,
      };
    })
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  const match = ranked.find((entry) => isLocale(entry.language));
  return match ? (match.language as Locale) : DEFAULT_LOCALE;
}
