"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Mail, Siren } from "lucide-react";
import Link from "next/link";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";
import { CONTACT } from "../_lib/content";
import { useContent } from "../_lib/use-content";
import { Wordmark } from "./icons";
import { PopIn, useSeen } from "./motion";

const messages = defineMessages({
  en: {
    home: "CabinGuard home",
    tagline:
      "Driver health monitoring, family alerts and emergency response — so every journey ends the way it should.",
    emergencyStrong:
      "CabinGuard supports emergency services — it never replaces them.",
    emergency: "If someone is in danger, call your local emergency number.",
    demoTitle: "See CabinGuard on your own fleet",
    demoBody:
      "A 30-minute walkthrough of the console, the app and the cabin unit.",
    demo: "Request a demo",
    rights: (year: number) => `© ${year} CabinGuard. All rights reserved.`,
  },
  fr: {
    home: "Accueil CabinGuard",
    tagline:
      "Surveillance de la santé du conducteur, alertes familiales et intervention d’urgence — pour que chaque trajet se termine comme il se doit.",
    emergencyStrong:
      "CabinGuard soutient les services d’urgence — il ne les remplace jamais.",
    emergency:
      "Si quelqu’un est en danger, appelez le numéro d’urgence local.",
    demoTitle: "Découvrez CabinGuard sur votre propre flotte",
    demoBody:
      "Une présentation de 30 minutes de la console, de l’application et du boîtier embarqué.",
    demo: "Demander une démo",
    rights: (year: number) => `© ${year} CabinGuard. Tous droits réservés.`,
  },
});

export function SiteFooter() {
  const t = useMessages(messages);
  const { FOOTER_COLUMNS, demoHref } = useContent();
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-[var(--lp-footer)] text-white" aria-labelledby="footer-title">
      <h2 id="footer-title" className="sr-only">
        CabinGuard
      </h2>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_85%_0%,rgba(36,98,255,0.28),transparent_70%),radial-gradient(40%_60%_at_0%_100%,rgba(91,61,245,0.16),transparent_70%)]"
      />
      <HeartbeatLine />

      <div className="lp-container relative">
        <div className="grid gap-12 pb-14 pt-[clamp(56px,5vw,84px)] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,2fr)] lg:gap-[clamp(40px,5vw,96px)]">
          <div>
            <Link href="/" aria-label={t.home} className="inline-block">
              <Wordmark size={26} light />
            </Link>
            <p className="mt-6 max-w-[400px] text-[16px] leading-relaxed text-white/70">
              {t.tagline}
            </p>
            <div className="mt-7 space-y-3">
              <a
                href={`mailto:${CONTACT.salesEmail}`}
                className="group flex items-center gap-3 text-[15px] text-white/85 transition-colors hover:text-white"
              >
                <span className="grid size-9 place-items-center rounded-[10px] bg-white/[0.07] text-[#8fb4ff]">
                  <Mail size={16} />
                </span>
                {CONTACT.salesEmail}
              </a>
              <a
                href={`mailto:${CONTACT.supportEmail}`}
                className="group flex items-center gap-3 text-[15px] text-white/85 transition-colors hover:text-white"
              >
                <span className="grid size-9 place-items-center rounded-[10px] bg-white/[0.07] text-[#8fb4ff]">
                  <Mail size={16} />
                </span>
                {CONTACT.supportEmail}
              </a>
            </div>
            <div className="mt-8 flex max-w-[440px] gap-3 rounded-[16px] border border-[#ff5a64]/25 bg-[#ff5a64]/[0.07] p-4">
              <Siren size={20} className="mt-0.5 flex-none text-[#ff8a92]" />
              <p className="text-[14px] leading-relaxed text-white/75">
                <span className="font-semibold text-white">{t.emergencyStrong}</span>{" "}
                {t.emergency}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {FOOTER_COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-white/45">{column.title}</p>
                <ul className="mt-5 space-y-3.5">
                  {column.links.map((link) => (
                    <li key={`${link.label}-${link.href}`}>
                      <a
                        href={link.href}
                        className="group inline-flex items-center gap-1 text-[15.5px] text-white/80 transition-colors hover:text-white"
                      >
                        {link.label}
                        <ArrowUpRight
                          size={14}
                          className="-translate-x-1 opacity-0 transition-[opacity,translate] duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <div className="col-span-2 rounded-[20px] border border-white/10 bg-[linear-gradient(135deg,rgba(47,107,255,0.22),rgba(47,107,255,0.06))] p-6 sm:col-span-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div>
                <p className="text-[19px] font-bold tracking-[-0.02em]">{t.demoTitle}</p>
                <p className="mt-1 text-[14.5px] text-white/65">{t.demoBody}</p>
              </div>
              <PopIn delay={0.1} className="mt-5 inline-flex shrink-0 sm:mt-0">
                <a href={demoHref} className="lp-btn-primary h-12 px-6 text-[15.5px]">
                  {t.demo} <ArrowUpRight size={17} />
                </a>
              </PopIn>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 py-7 text-[14px] text-white/55">
          <p suppressHydrationWarning>{t.rights(year)}</p>
        </div>
      </div>

      <p
        aria-hidden="true"
        className="pointer-events-none relative -mb-[0.24em] select-none whitespace-nowrap bg-linear-to-b from-[#8fb4ff]/20 to-transparent bg-clip-text text-center text-[clamp(64px,15.5vw,270px)] font-extrabold leading-[0.9] tracking-[-0.06em] text-transparent"
      >
        CabinGuard
      </p>
    </footer>
  );
}

/** A heartbeat trace across the top of the footer, drawn once on arrival. */
function HeartbeatLine() {
  const { ref, seen } = useSeen<SVGSVGElement>(0.4);
  const show = seen;
  const trace =
    "M0 40 H560 l14 -6 l10 6 h20 l10 -30 l14 58 l12 -40 l8 12 h26 l10 -4 l8 4 H1672";
  return (
    <svg
      ref={ref}
      className="absolute inset-x-0 top-0 h-[80px] w-full"
      viewBox="0 0 1672 80"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lp-footer-trace" x1="0" x2="1">
          <stop offset="0" stopColor="#2f6bff" stopOpacity="0" />
          <stop offset="0.3" stopColor="#4c8dff" stopOpacity="0.7" />
          <stop offset="0.42" stopColor="#8fb4ff" />
          <stop offset="0.6" stopColor="#4c8dff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#2f6bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={trace}
        fill="none"
        stroke="url(#lp-footer-trace)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={show ? { pathLength: 1 } : undefined}
        transition={{ duration: 2.2, ease: "easeInOut" }}
      />
    </svg>
  );
}
