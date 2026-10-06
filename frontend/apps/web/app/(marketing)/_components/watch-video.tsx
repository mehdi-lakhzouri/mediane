"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Play, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { EASE } from "./motion";

/**
 * "Watch video" opens the walkthrough. Until the film is produced, the
 * dialog says so plainly and offers the written walkthrough instead.
 */
const VIDEO_URL: string | null = null;

export function WatchVideoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <span className="grid size-[34px] place-items-center rounded-full border-2 border-[#c9d8fb] text-[var(--lp-blue)]">
          <Play size={15} fill="currentColor" strokeWidth={0} className="translate-x-px" />
        </span>
        Watch video
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(6,22,49,0.55)] p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onPointerDown={(event) => event.target === event.currentTarget && setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="CabinGuard product video"
              initial={{ y: 18, scale: 0.97, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="relative w-full max-w-[880px] overflow-hidden rounded-[24px] bg-white shadow-[var(--lp-shadow-float)]"
            >
              <button
                ref={close}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close video"
                className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-white/90 text-[var(--lp-ink)] shadow"
              >
                <X size={18} />
              </button>
              {VIDEO_URL ? (
                <video src={VIDEO_URL} controls autoPlay className="aspect-video w-full bg-black" />
              ) : (
                <div className="relative aspect-video w-full">
                  <Image
                    src="/landing/scene-faq.webp"
                    alt=""
                    fill
                    sizes="880px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(6,22,49,0.85)] via-[rgba(6,22,49,0.25)] to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-8 text-white">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.24em] text-white/70">
                      Product film
                    </p>
                    <p className="mt-2 max-w-[520px] text-[24px] font-bold leading-snug tracking-[-0.02em]">
                      The walkthrough video is in production.
                    </p>
                    <a
                      href="#how-it-works"
                      onClick={() => setOpen(false)}
                      className="lp-btn-primary mt-5 h-12 px-6 text-[16px]"
                    >
                      See how CabinGuard works <ArrowRight size={17} />
                    </a>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
