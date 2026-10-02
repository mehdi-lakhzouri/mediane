"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, type LucideIcon } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { ThemeToggle } from "./theme-toggle";

interface RecoveryShellProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  visual?: "default" | "password-reset";
  /** Reassurance line at the bottom of the page. */
  footnote?: string;
  children: React.ReactNode;
}

export function RecoveryShell({
  icon: Icon,
  eyebrow,
  title,
  description,
  visual = "default",
  footnote = "Secure recovery. Your reset link is single-use and time-limited.",
  children,
}: RecoveryShellProps) {
  const reduceMotion = useReducedMotion();

  return (
    <main
      className={`recovery-canvas relative min-h-svh overflow-hidden text-[var(--sx-ink)] ${visual === "password-reset" ? "reset-password-canvas" : ""}`}
    >
      <div className="recovery-background" aria-hidden="true" />
      <div className="recovery-shade" aria-hidden="true" />
      <div className="recovery-orb recovery-orb-left" aria-hidden="true" />
      <div className="recovery-orb recovery-orb-right" aria-hidden="true" />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="absolute top-5 left-5 z-20 sm:top-8 sm:left-9"
      >
        <Link
          href="/"
          aria-label="Back to CabinGuard sign in"
          className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-[#30b5ff] focus-visible:ring-offset-4 focus-visible:outline-none"
        >
          <BrandLogo compact />
        </Link>
      </motion.div>
      <ThemeToggle />

      <div className="relative z-10 grid min-h-svh place-items-center px-4 pt-28 pb-20 sm:px-6 sm:pt-32">
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            delay: reduceMotion ? 0 : 0.08,
            duration: reduceMotion ? 0 : 0.68,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="recovery-card w-full max-w-[560px] rounded-[28px] px-5 py-7 sm:px-11 sm:py-10"
        >
          <motion.div
            animate={
              reduceMotion ? undefined : { y: [0, -4, 0], rotate: [0, 1.5, 0] }
            }
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="recovery-icon mx-auto grid size-[78px] place-items-center rounded-[24px]"
          >
            <Icon className="size-8" strokeWidth={1.8} />
          </motion.div>

          <div className="mt-6 text-center">
            <p className="text-[11px] font-bold tracking-[0.24em] text-[var(--sx-accent)] uppercase">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.045em] sm:text-[36px]">
              {title}
            </h1>
            <p className="mx-auto mt-3 max-w-[430px] text-[14px] leading-6 text-[var(--sx-body)] sm:text-[15px]">
              {description}
            </p>
          </div>

          <div className="mt-7">{children}</div>
        </motion.section>
      </div>

      <div className="absolute right-0 bottom-5 left-0 z-10 flex items-center justify-center gap-2 px-4 text-center text-[11px] text-[var(--sx-muted)] sm:text-xs">
        <ShieldCheck className="size-4 text-[var(--sx-icon-soft)]" />
        <span className="max-w-[310px] leading-4">{footnote}</span>
      </div>
    </main>
  );
}
