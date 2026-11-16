"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";
import { LanguageSwitch, LanguageToggle } from "../../components/language-switch";
import { useContent } from "../_lib/use-content";
import { Wordmark } from "./icons";
import { EASE, PopIn } from "./motion";

const messages = defineMessages({
  en: {
    home: "Mediane home",
    main: "Main",
    signIn: "Sign in",
    demo: "Request demo",
    // Narrow desktop widths (below 2xl) where the full label does not fit.
    demoShort: "Request demo",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  fr: {
    home: "Accueil Mediane",
    main: "Principal",
    signIn: "Connexion",
    demo: "Demander une démo",
    demoShort: "Démo",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
  },
});

export function SiteHeader() {
  const t = useMessages(messages);
  const { NAV, demoHref } = useContent();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(null);
        setMobileOpen(false);
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  const hoverOpen = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(label);
  };
  const hoverClose = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 140);
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-[background,box-shadow,border-color] duration-300 ${
        scrolled
          ? "border-[var(--lp-line)] bg-white/85 shadow-[0_8px_30px_-18px_rgba(16,40,94,0.35)] backdrop-blur-xl"
          : "border-[rgba(214,225,243,0.6)] bg-white/70 backdrop-blur-md"
      }`}
    >
      <div className="lp-container flex h-[70px] items-center gap-6">
        <Link href="/" aria-label={t.home} className="shrink-0">
          <Wordmark size={24} />
        </Link>

        <nav
          ref={navRef}
          aria-label={t.main}
          className="mx-auto hidden items-center gap-[clamp(14px,2.3vw,56px)] lg:flex"
        >
          {NAV.map((group) =>
            group.links ? (
              <div
                key={group.label}
                className="relative"
                onPointerEnter={() => hoverOpen(group.label)}
                onPointerLeave={hoverClose}
              >
                <button
                  type="button"
                  aria-expanded={open === group.label}
                  aria-controls={`menu-${group.label}`}
                  onClick={() => setOpen(open === group.label ? null : group.label)}
                  className="flex items-center gap-1.5 whitespace-nowrap py-2 text-[clamp(15px,1vw,16px)] font-medium text-[var(--lp-ink-soft)] transition-colors hover:text-[var(--lp-blue)]"
                >
                  {group.label}
                  <ChevronDown
                    size={16}
                    strokeWidth={2.2}
                    className={`transition-transform duration-300 ${open === group.label ? "rotate-180" : ""}`}
                  />
                </button>
                <AnimatePresence>
                  {open === group.label ? (
                    <motion.div
                      id={`menu-${group.label}`}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="lp-card absolute left-1/2 top-full z-10 mt-3 w-[320px] -translate-x-1/2 p-2"
                    >
                      {group.links.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          onClick={() => setOpen(null)}
                          className="block rounded-xl px-4 py-3 transition-colors hover:bg-[var(--lp-blue-tint)]"
                        >
                          <span className="block text-[15px] font-semibold text-[var(--lp-ink)]">
                            {link.label}
                          </span>
                          <span className="mt-0.5 block text-[13px] text-[var(--lp-muted)]">
                            {link.description}
                          </span>
                        </a>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : (
              <a
                key={group.label}
                href={group.href}
                className="py-2 text-[16px] font-medium text-[var(--lp-ink-soft)] transition-colors hover:text-[var(--lp-blue)]"
              >
                {group.label}
              </a>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-4 lg:ml-0">
          <PopIn delay={0.05} className="hidden sm:inline-flex">
            <LanguageToggle />
          </PopIn>
          <PopIn delay={0.1} className="hidden sm:inline-flex">
            <Link
              href="/sign-in"
              className="inline-flex h-[44px] items-center whitespace-nowrap rounded-[10px] border border-[var(--lp-line-strong)] bg-white/80 px-5 text-[15px] font-medium text-[var(--lp-ink)] transition-colors hover:border-[var(--lp-blue-line)]"
            >
              {t.signIn}
            </Link>
          </PopIn>
          <PopIn delay={0.2} className="hidden md:inline-flex">
            <a href={demoHref} className="lp-btn-primary h-[44px] whitespace-nowrap rounded-[10px] px-6 text-[15px]">
              <span className="hidden 2xl:inline">{t.demo}</span>
              <span className="2xl:hidden">{t.demoShort}</span>
              <ArrowRight size={17} strokeWidth={2.2} />
            </a>
          </PopIn>
          <button
            type="button"
            className="grid size-[44px] place-items-center rounded-full border border-[var(--lp-line-strong)] bg-white lg:hidden"
            aria-label={mobileOpen ? t.closeMenu : t.openMenu}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen ? <MobileMenu onClose={() => setMobileOpen(false)} /> : null}
      </AnimatePresence>
    </header>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const t = useMessages(messages);
  const { NAV, demoHref } = useContent();
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="overflow-hidden border-t border-[var(--lp-line)] bg-white lg:hidden"
    >
      <div className="lp-container grid gap-6 py-6">
        {NAV.map((group) => (
          <div key={group.label}>
            {group.links ? (
              <>
                <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--lp-muted)]">
                  {group.label}
                </p>
                <div className="mt-2 grid">
                  {group.links.map((link) => (
                    <a key={link.label} href={link.href} onClick={onClose} className="py-2 text-[16px] font-medium">
                      {link.label}
                    </a>
                  ))}
                </div>
              </>
            ) : (
              <a href={group.href} onClick={onClose} className="text-[16px] font-semibold">
                {group.label}
              </a>
            )}
          </div>
        ))}
        <LanguageSwitch variant="marketing" className="w-fit" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/sign-in" className="lp-btn-secondary h-12">
            {t.signIn}
          </Link>
          <a href={demoHref} className="lp-btn-primary h-12">
            {t.demo} <ArrowRight size={17} />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
