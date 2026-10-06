"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { demoHref, FAQ, NAV } from "../_lib/content";
import { Wordmark } from "./icons";
import { EASE, PopIn } from "./motion";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
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
        <Link href="/" aria-label="CabinGuard home" className="shrink-0">
          <Wordmark size={24} />
        </Link>

        <nav
          ref={navRef}
          aria-label="Main"
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
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search the site"
            className="hidden size-[44px] place-items-center rounded-full border border-[var(--lp-line-strong)] bg-white/80 text-[var(--lp-ink-soft)] transition-colors hover:border-[var(--lp-blue-line)] hover:text-[var(--lp-blue)] sm:grid lg:hidden xl:grid"
          >
            <Search size={19} strokeWidth={2} />
          </button>
          <PopIn delay={0.1} className="hidden sm:inline-flex">
            <Link
              href="/sign-in"
              className="inline-flex h-[44px] items-center whitespace-nowrap rounded-[10px] border border-[var(--lp-line-strong)] bg-white/80 px-5 text-[15px] font-medium text-[var(--lp-ink)] transition-colors hover:border-[var(--lp-blue-line)]"
            >
              Sign in
            </Link>
          </PopIn>
          <PopIn delay={0.2} className="hidden md:inline-flex">
            <a href={demoHref} className="lp-btn-primary h-[44px] whitespace-nowrap rounded-[10px] px-6 text-[15px]">
              Request demo
              <ArrowRight size={17} strokeWidth={2.2} />
            </a>
          </PopIn>
          <button
            type="button"
            className="grid size-[44px] place-items-center rounded-full border border-[var(--lp-line-strong)] bg-white lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
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
      <AnimatePresence>
        {searchOpen ? <SearchPalette onClose={() => setSearchOpen(false)} /> : null}
      </AnimatePresence>
    </header>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/sign-in" className="lp-btn-secondary h-12">
            Sign in
          </Link>
          <a href={demoHref} className="lp-btn-primary h-12">
            Request demo <ArrowRight size={17} />
          </a>
        </div>
      </div>
    </motion.div>
  );
}

type Destination = { label: string; hint: string; href: string };

function SearchPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const destinations = useMemo<Destination[]>(() => {
    const pages = NAV.flatMap((group) =>
      group.links
        ? group.links.map((link) => ({ label: link.label, hint: group.label, href: link.href }))
        : [{ label: group.label, hint: "Page section", href: group.href ?? "#" }],
    );
    const questions = FAQ.map((item) => ({ label: item.question, hint: "FAQ", href: "#faq" }));
    return [...pages, ...questions];
  }, []);

  const results = destinations
    .filter((d) => `${d.label} ${d.hint}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const go = (destination: Destination | undefined) => {
    if (!destination) return;
    onClose();
    window.location.href = destination.href;
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid items-start justify-items-center bg-[rgba(10,19,48,0.35)] px-4 pt-[12vh] backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search the site"
        initial={{ y: -12, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="lp-card w-full max-w-[560px] overflow-hidden p-0"
      >
        <div className="flex items-center gap-3 border-b border-[var(--lp-line)] px-5">
          <Search size={18} className="text-[var(--lp-muted)]" />
          <input
            ref={input}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") setActive((i) => Math.min(i + 1, results.length - 1));
              if (event.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
              if (event.key === "Enter") go(results[active]);
              if (event.key === "Escape") onClose();
            }}
            placeholder="Search features, safety, FAQ…"
            aria-label="Search"
            className="h-14 w-full bg-transparent text-[16px] outline-none placeholder:text-[var(--lp-faint)]"
          />
          <kbd className="rounded-md border border-[var(--lp-line)] px-2 py-0.5 text-[11px] text-[var(--lp-muted)]">Esc</kbd>
        </div>
        <ul className="max-h-[360px] overflow-y-auto p-2" role="listbox" aria-label="Results">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-[14px] text-[var(--lp-muted)]">
              Nothing matches “{query}”. Try “alerts” or “privacy”.
            </li>
          ) : (
            results.map((result, index) => (
              <li key={`${result.hint}-${result.label}`} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  onPointerEnter={() => setActive(index)}
                  onClick={() => go(result)}
                  className={`flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left ${
                    index === active ? "bg-[var(--lp-blue-tint)]" : ""
                  }`}
                >
                  <span className="text-[15px] font-medium text-[var(--lp-ink)]">{result.label}</span>
                  <span className="shrink-0 text-[12px] text-[var(--lp-muted)]">{result.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </motion.div>
    </motion.div>
  );
}
