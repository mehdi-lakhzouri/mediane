import { defineMessages } from "../../lib/i18n/messages";
import { getMessages, localizedMetadata } from "../../lib/i18n/server";
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

const EN_TITLE = "Mediane | Driver health monitoring for a safer tomorrow";
const EN_DESCRIPTION =
  "Real-time driver health monitoring, family alerts, emergency response and incident management in one platform.";
const FR_TITLE =
  "Mediane | La surveillance de la santé du conducteur pour un avenir plus sûr";
const FR_DESCRIPTION =
  "Surveillance en temps réel de la santé du conducteur, alertes familiales, intervention d’urgence et gestion des incidents dans une seule plateforme.";

export const generateMetadata = localizedMetadata({
  en: {
    title: EN_TITLE,
    description: EN_DESCRIPTION,
    openGraph: {
      title: EN_TITLE,
      description: EN_DESCRIPTION,
      type: "website",
      locale: "en_GB",
    },
  },
  fr: {
    title: FR_TITLE,
    description: FR_DESCRIPTION,
    openGraph: {
      title: FR_TITLE,
      description: FR_DESCRIPTION,
      type: "website",
      locale: "fr_FR",
    },
  },
});

const messages = defineMessages({
  en: { skip: "Skip to content" },
  fr: { skip: "Aller au contenu" },
});

export default async function LandingPage() {
  const t = await getMessages(messages);
  return (
    <div id="top">
      <a
        href="#main"
        className="sr-only z-[80] rounded-lg bg-white px-4 py-2 font-semibold text-[var(--lp-blue)] shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t.skip}
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
