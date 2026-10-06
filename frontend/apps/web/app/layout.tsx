import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
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

export const metadata: Metadata = {
  title: "CabinGuard",
  description:
    "Driver health monitoring, family safety and emergency response for every journey.",
};

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
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("cg.signin.theme");document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light");}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The script above mutates this element before React hydrates (that's the
    // whole point: no flash of the wrong theme). React would otherwise warn
    // that the server-rendered attribute doesn't match the DOM it hydrates
    // onto — suppressHydrationWarning silences only that one expected mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${manrope.variable} ${geist.variable} ${geistMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
