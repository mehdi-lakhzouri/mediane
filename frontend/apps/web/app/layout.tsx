import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import { LocaleProvider } from "../lib/i18n/locale-provider";
import { defineMessages } from "../lib/i18n/messages";
import { getLocale, getMessages } from "../lib/i18n/server";
import "./globals.css";

/**
 * Three faces, each with one job:
 * - Manrope keeps the sign-in screen exactly as designed.
 * - Geist is the console interface face: a neutral grotesque that stays legible
 *   at 11px label sizes.
 * - Geist Mono carries measured values, so metrics read as instrument output
 *   and digits line up column to column.
 * Only the variables are declared here; each surface picks its own family.
 */
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const messages = defineMessages({
  en: {
    description:
      "Driver health monitoring, family safety and emergency response for every journey.",
  },
  fr: {
    description:
      "Surveillance de la santé du conducteur, sécurité familiale et intervention d’urgence à chaque trajet.",
  },
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(messages);
  return {
    title: "Mediane",
    applicationName: "Mediane",
    description: t.description,
    appleWebApp: { title: "Mediane" },
  };
}

// Applies a saved sign-in theme preference to <html> before first paint, so
// returning dark-mode visitors never see a flash of the light page. Runs on
// every route (cheap no-op where nothing reads data-theme).
//
// This is a literal <script> tag, not next/script: next/script's
// `beforeInteractive` strategy still ships inside an async-loaded framework
// chunk, so it can execute after first paint on a slow connection. A raw
// inline script in the HTML stream is parsed and executed synchronously by
// the browser, in place, before anything after it — the only way to
// guarantee this actually runs before the page is shown.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("cg.signin.theme");document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark");}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read from the cookie / Accept-Language on every request: the same URL
  // serves both languages.
  const locale = await getLocale();

  return (
    // The script above mutates this element before React hydrates (that's the
    // whole point: no flash of the wrong theme). React would otherwise warn
    // that the server-rendered attribute doesn't match the DOM it hydrates
    // onto — suppressHydrationWarning silences only that one expected mismatch.
    <html lang={locale} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${manrope.variable} ${geist.variable} ${geistMono.variable}`}
      >
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
