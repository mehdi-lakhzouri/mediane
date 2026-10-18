"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  CarFront,
  Check,
  ChevronLeft,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Lines } from "../../lib/i18n/lines";
import { useMessages } from "../../lib/i18n/locale-provider";
import { defineMessages } from "../../lib/i18n/messages";
import { BrandLogo } from "./brand-logo";
import { LanguageSwitch } from "./language-switch";

const messages = defineMessages({
  en: {
    signIn: "CabinGuard sign in",
    eyebrow: "Multi-factor security",
    title: "Stronger security for safer",
    titleAccent: "journeys",
    copy: "CabinGuard protects your account with multi-factor authentication, keeping your data and drivers safe.",
    benefits: "Multi-factor security benefits",
    features: [
      {
        title: "Protect your data",
        body: "A second layer of security for every sign-in.",
      },
      {
        title: "Use your authenticator app",
        body: "Scan a QR code to connect your account.",
      },
      {
        title: "Your codes, your access",
        body: "Keep control even without your phone.",
      },
      {
        title: "Built for what matters",
        body: "Secure people, vehicles and critical data.",
      },
    ],
    tagline: ["Safer Drivers.", "Smarter Journeys."],
    back: "Go back",
    help: "Need help?",
    progress: "Multi-factor setup progress",
    steps: ["Scan QR Code", "Verify", "Complete"] as [string, string, string],
  },
  fr: {
    signIn: "Connexion CabinGuard",
    eyebrow: "Sécurité multifacteur",
    title: "Une sécurité renforcée pour des",
    titleAccent: "trajets plus sûrs",
    copy: "CabinGuard protège votre compte grâce à l’authentification multifacteur, pour garder vos données et vos conducteurs en sécurité.",
    benefits: "Avantages de la sécurité multifacteur",
    features: [
      {
        title: "Protégez vos données",
        body: "Une seconde couche de sécurité à chaque connexion.",
      },
      {
        title: "Utilisez votre application d’authentification",
        body: "Scannez un QR code pour relier votre compte.",
      },
      {
        title: "Vos codes, votre accès",
        body: "Gardez le contrôle, même sans votre téléphone.",
      },
      {
        title: "Conçu pour l’essentiel",
        body: "Protège les personnes, les véhicules et les données critiques.",
      },
    ],
    tagline: ["Des conducteurs protégés.", "Des trajets plus intelligents."],
    back: "Retour",
    help: "Besoin d’aide ?",
    progress: "Progression de la configuration multifacteur",
    steps: ["Scanner le QR code", "Vérifier", "Terminé"],
  },
});

const FEATURE_ICONS = [ShieldCheck, Smartphone, LockKeyhole, CarFront];

interface MfaSecurityShellProps {
  children: ReactNode;
  activeStep: 0 | 1 | 2;
  progressLabels?: readonly [string, string, string];
  onBack?: () => void;
  backHref?: string;
}

export function MfaSecurityShell({
  children,
  activeStep,
  progressLabels,
  onBack,
  backHref = "/sign-in",
}: MfaSecurityShellProps) {
  const t = useMessages(messages);
  const steps = progressLabels ?? t.steps;

  return (
    <main className="mfa-security-canvas min-h-svh">
      <div className="mfa-security-backdrop" aria-hidden="true" />
      <div className="mfa-security-page-shade" aria-hidden="true" />
      <div className="mfa-security-frame">
        <aside className="mfa-security-story">
          <div className="mfa-security-story-image" aria-hidden="true" />
          <div className="mfa-security-story-shade" aria-hidden="true" />
          <div className="relative z-10 flex min-h-full flex-col">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/sign-in"
                aria-label={t.signIn}
                className="rounded-xl focus-visible:ring-2 focus-visible:ring-[#25c8ff] focus-visible:outline-none"
              >
                <BrandLogo compact />
              </Link>
              <LanguageSwitch variant="mfa" />
            </div>
            <p className="mfa-story-eyebrow mt-10 text-[10px] font-extrabold tracking-[0.28em] text-[#29c8ff] uppercase">
              {t.eyebrow}
            </p>
            <h2 className="mfa-story-title mt-3 max-w-[290px] text-[clamp(32px,3vw,44px)] font-extrabold leading-[1.08] tracking-[-0.055em] text-white">
              {t.title} <span className="text-[#6ad7ff]">{t.titleAccent}</span>
            </h2>
            <p className="mfa-story-copy mt-4 max-w-[310px] text-[14px] leading-[1.55] text-[#bbcade]">
              {t.copy}
            </p>
            <ul
              className="mfa-story-features mt-8 space-y-5"
              aria-label={t.benefits}
            >
              {t.features.map((feature, index) => {
                const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length]!;
                return (
                  <li
                    key={feature.title}
                    className="mfa-story-feature flex items-start gap-4"
                  >
                    <span className="mfa-feature-icon">
                      <Icon className="size-5" strokeWidth={1.8} />
                    </span>
                    <span className="pt-0.5">
                      <strong className="block text-[13px] font-extrabold text-white">
                        {feature.title}
                      </strong>
                      <span className="mfa-story-feature-copy mt-1 block max-w-[205px] text-[12px] leading-[1.45] text-[#b3c1d4]">
                        {feature.body}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mfa-story-tagline mt-auto pt-8 text-[16px] font-extrabold leading-[1.3] text-[#58ceff]">
              <Lines lines={t.tagline} />
            </p>
          </div>
        </aside>
        <section className="mfa-security-content">
          <header className="mfa-security-header flex items-center justify-between">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="mfa-back-button"
                aria-label={t.back}
              >
                <ChevronLeft className="size-5" />
              </button>
            ) : (
              <Link
                href={backHref}
                className="mfa-back-button"
                aria-label={t.back}
              >
                <ChevronLeft className="size-5" />
              </Link>
            )}
            <a
              href="mailto:support@cabinguard.com"
              className="text-[12px] font-semibold text-[#35c9ff] transition hover:text-[#87e3ff]"
            >
              {t.help}
            </a>
          </header>
          <ol className="mfa-progress" aria-label={t.progress}>
            {steps.map((label, index) => {
              const done = index < activeStep;
              const active = index === activeStep;
              return (
                <li
                  key={label}
                  className={`mfa-progress-step ${active ? "is-active" : ""} ${done ? "is-done" : ""}`}
                  aria-current={active ? "step" : undefined}
                >
                  <span className="mfa-progress-dot">
                    {done ? (
                      <Check className="size-4" strokeWidth={2.7} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="mfa-progress-label">{label}</span>
                </li>
              );
            })}
          </ol>
          <div className="mfa-security-body">{children}</div>
        </section>
      </div>
    </main>
  );
}
