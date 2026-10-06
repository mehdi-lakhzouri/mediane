import { Plus_Jakarta_Sans } from "next/font/google";
import "./landing.css";

/**
 * Marketing pages share one face: Plus Jakarta Sans, set tight and heavy for
 * headlines and open at regular weight for reading, as in the approved
 * mockups. Scoped to this route group so the console keeps its own faces.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${jakarta.variable} lp-root min-h-svh overflow-x-clip`}>
      {/* Entrance animations start hidden; without JavaScript, show everything. */}
      <noscript>
        <style>{`.lp-root [style*="opacity:0"]{opacity:1!important;transform:none!important}.lp-root [pathLength]{stroke-dasharray:none!important}.lp-root .lp-tw-char{opacity:1!important;filter:none!important}.lp-root .lp-tw-caret{display:none}`}</style>
      </noscript>
      {children}
    </div>
  );
}
