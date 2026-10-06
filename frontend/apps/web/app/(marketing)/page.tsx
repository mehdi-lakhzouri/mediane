import type { Metadata } from "next";
import { BackToTop } from "./_components/back-to-top";
import { Detection } from "./_components/detection";
import { DriverApp } from "./_components/driver-app";
import { Faq } from "./_components/faq";
import { Features } from "./_components/features";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { Impact } from "./_components/impact";
import { Plans } from "./_components/plans";
import { Privacy } from "./_components/privacy";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

export const metadata: Metadata = {
  title: "CabinGuard | Driver health monitoring for a safer tomorrow",
  description:
    "Real-time driver health monitoring, family alerts, emergency response and incident management in one platform.",
  openGraph: {
    title: "CabinGuard | Driver health monitoring for a safer tomorrow",
    description:
      "Real-time driver health monitoring, family alerts, emergency response and incident management in one platform.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div id="top">
      <a
        href="#main"
        className="sr-only z-[80] rounded-lg bg-white px-4 py-2 font-semibold text-[var(--lp-blue)] shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Features />
        <HowItWorks />
        <Detection />
        <DriverApp />
        <Impact />
        <Privacy />
        <Plans />
        <Faq />
      </main>
      <SiteFooter />
      <BackToTop />
    </div>
  );
}
