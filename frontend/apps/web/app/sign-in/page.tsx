import { localizedMetadata } from "../../lib/i18n/server";
import { HeroPanel } from "../components/hero-panel";
import { LoginCard } from "../components/login-card";
import { DayStatus } from "../components/day-status";
import { LanguageSwitch } from "../components/language-switch";
import { ThemeToggle } from "../components/theme-toggle";
import { BrandLogo } from "../components/brand-logo";

export const generateMetadata = localizedMetadata({
  en: {
    title: "Sign in | CabinGuard",
    description: "Secure access to your CabinGuard journey and health data.",
  },
  fr: {
    title: "Connexion | CabinGuard",
    description:
      "Accès sécurisé à vos trajets et à vos données de santé CabinGuard.",
  },
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>;
}) {
  const reason = (await searchParams).reason;
  const inactive = reason === "inactive";
  return (
    <main
      className="relative min-h-svh overflow-x-hidden"
      style={{ background: "var(--sx-page-bg)", color: "var(--sx-ink)" }}
    >
      <div className="hero-background" aria-hidden="true" />
      <div className="hero-shade" aria-hidden="true" />
      <LanguageSwitch variant="auth" />
      <ThemeToggle />

      <div className="relative z-10 mx-auto grid min-h-svh w-full max-w-[1800px] grid-cols-1 items-center gap-10 px-5 py-6 sm:px-8 lg:px-10 xl:grid-cols-[minmax(0,1fr)_minmax(520px,602px)] xl:items-stretch xl:gap-12 xl:px-[3.8vw] xl:pt-[clamp(48px,8.5vh,80px)] xl:pb-[clamp(42px,7.35vh,69px)]">
        {/* Marketing copy and feature cards live here, shown from xl up only. */}
        <HeroPanel />

        <section className="relative flex flex-col items-center justify-center gap-6 xl:items-stretch">
          {/* Below xl, HeroPanel's full lockup is hidden, so this is the only
              thing identifying the product — everything else on this screen
              below that breakpoint is the sign-in form, nothing more. */}
          <div className="flex xl:hidden">
            <BrandLogo compact />
          </div>
          <DayStatus />
          <LoginCard sessionExpired={inactive} />
        </section>
      </div>
    </main>
  );
}
