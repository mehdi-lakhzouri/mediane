"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  CarFront,
  Check,
  ChevronDown,
  ChevronLeft,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { BrandLogo } from "./brand-logo";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Protect your data",
    body: "A second layer of security for every sign-in.",
  },
  {
    icon: Smartphone,
    title: "Use your authenticator app",
    body: "Scan a QR code to connect your account.",
  },
  {
    icon: LockKeyhole,
    title: "Your codes, your access",
    body: "Keep control even without your phone.",
  },
  {
    icon: CarFront,
    title: "Built for what matters",
    body: "Secure people, vehicles and critical data.",
  },
];

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
  progressLabels = ["Scan QR Code", "Verify", "Complete"],
  onBack,
  backHref = "/",
}: MfaSecurityShellProps) {
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
                href="/"
                aria-label="CabinGuard sign in"
                className="rounded-xl focus-visible:ring-2 focus-visible:ring-[#25c8ff] focus-visible:outline-none"
              >
                <BrandLogo compact />
              </Link>
              <span className="mfa-language" aria-label="Language: English">
                EN <ChevronDown className="size-3.5" />
              </span>
            </div>
            <p className="mfa-story-eyebrow mt-10 text-[10px] font-extrabold tracking-[0.28em] text-[#29c8ff] uppercase">
              Multi-factor security
            </p>
            <h2 className="mfa-story-title mt-3 max-w-[290px] text-[clamp(32px,3vw,44px)] font-extrabold leading-[1.08] tracking-[-0.055em] text-white">
              Stronger security for safer{" "}
              <span className="text-[#6ad7ff]">journeys</span>
            </h2>
            <p className="mfa-story-copy mt-4 max-w-[310px] text-[14px] leading-[1.55] text-[#bbcade]">
              CabinGuard protects your account with multi-factor authentication,
              keeping your data and drivers safe.
            </p>
            <ul
              className="mfa-story-features mt-8 space-y-5"
              aria-label="Multi-factor security benefits"
            >
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
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
              Safer Drivers.
              <br />
              Smarter Journeys.
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
                aria-label="Go back"
              >
                <ChevronLeft className="size-5" />
              </button>
            ) : (
              <Link
                href={backHref}
                className="mfa-back-button"
                aria-label="Go back"
              >
                <ChevronLeft className="size-5" />
              </Link>
            )}
            <a
              href="mailto:support@cabinguard.com"
              className="text-[12px] font-semibold text-[#35c9ff] transition hover:text-[#87e3ff]"
            >
              Need help?
            </a>
          </header>
          <ol className="mfa-progress" aria-label="Multi-factor setup progress">
            {progressLabels.map((label, index) => {
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
