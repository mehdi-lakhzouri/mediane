"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { EASE, usePrefersReducedMotion } from "./motion";

const SHOW_AFTER = 480;

/**
 * A round floating button, bottom right, that appears once the page has been
 * scrolled and returns to the top. The ring around it fills as the reader
 * moves down the page.
 */
export function BackToTop() {
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setVisible(y > SHOW_AFTER));
  useEffect(() => setVisible(window.scrollY > SHOW_AFTER), []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] right-[max(20px,env(safe-area-inset-right))] z-40 sm:bottom-7 sm:right-7"
          initial={{ opacity: 0, y: 16, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.85 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <button
            type="button"
            aria-label="Back to top"
            title="Back to top"
            onClick={() => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })}
            className="lp-btn-primary group relative size-12 rounded-full ring-4 ring-white/70 sm:size-14"
          >
            <svg viewBox="0 0 56 56" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
              <circle cx="28" cy="28" r="25" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2.5" />
              <motion.circle
                cx="28"
                cy="28"
                r="25"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ pathLength: scrollYProgress }}
              />
            </svg>
            <ArrowUp
              size={20}
              strokeWidth={2.4}
              className="relative transition-transform duration-200 group-hover:-translate-y-0.5"
            />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
