"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useId } from "react";
import { FEATURES } from "../_lib/content";
import { ConsoleLive, LIVE_SIZE } from "./console-live";
import { Icon } from "./icons";
import { EASE, Reveal, ScaledCanvas, usePrefersReducedMotion, useSeen } from "./motion";

const TILE = { blue: "", red: "lp-tile-red", violet: "lp-tile-violet" } as const;

export function Features() {
  return (
    <section id="features" className="lp-section-wash relative scroll-mt-20 overflow-hidden" aria-labelledby="features-title">
      <div className="lp-container relative grid gap-12 pb-[clamp(56px,5vw,88px)] pt-[clamp(56px,4.4vw,76px)] xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1fr)] xl:gap-6">
        <div className="relative z-10">
          <Reveal>
            <p className="lp-eyebrow">Features</p>
            <h2 id="features-title" className="lp-title mt-[clamp(20px,2.2vw,36px)]">
              Everything needed to
              <br />
              keep <span className="lp-accent">every journey safer.</span>
            </h2>
            <p className="lp-lead mt-[clamp(14px,1.3vw,22px)] max-w-[640px]">
              CabinGuard gives you a complete view of driver health, family safety, and vehicle incidents — with
              real-time insights, instant alerts, and powerful tools to keep people safer on the road.
            </p>
          </Reveal>

          <ul className="mt-[clamp(28px,2.4vw,40px)] grid gap-[14px] sm:grid-cols-2">
            {FEATURES.map((feature, index) => (
              <li key={feature.title}>
                <Reveal delay={0.06 * index} y={22} className="h-full">
                  <article className="group flex h-full gap-[clamp(14px,1.2vw,20px)] rounded-[20px] border border-white/90 bg-white/80 p-[clamp(18px,1.4vw,24px)] shadow-[var(--lp-shadow-card)] backdrop-blur-md transition-[transform,box-shadow,border-color] duration-300 ease-[var(--lp-ease)] hover:-translate-y-1 hover:border-[var(--lp-blue-line)] hover:shadow-[var(--lp-shadow-float)]">
                    <span
                      className={`lp-tile size-[clamp(54px,4.1vw,68px)] rounded-[16px] transition-transform duration-300 group-hover:scale-105 ${TILE[feature.tone]}`}
                    >
                      <Icon name={feature.icon} size={30} strokeWidth={2.1} />
                    </span>
                    <span>
                      <h3 className="pt-1 text-[clamp(16.5px,1.17vw,19.5px)] font-bold leading-[1.22] tracking-[-0.02em] text-[var(--lp-ink)]">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-[clamp(13.5px,0.93vw,15.5px)] leading-[1.42] text-[var(--lp-body)]">
                        {feature.body}
                      </p>
                    </span>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        <FeaturesStage />
      </div>
    </section>
  );
}

/** The live console floating over the road, with the shield watching the car. */
function FeaturesStage() {
  const { ref, seen } = useSeen<HTMLDivElement>(0.15);
  const show = seen;

  return (
    <div ref={ref} className="relative xl:-mr-[clamp(0px,3vw,48px)]">
      <div className="relative z-10 xl:mt-[clamp(0px,2.4vw,40px)]" style={{ perspective: 2400 }}>
        <motion.div
          style={{ transformOrigin: "0% 50%" }}
          initial={{ opacity: 0, rotateY: -24, rotateX: 4, y: 40 }}
          animate={show ? { opacity: 1, rotateY: -9, rotateX: 3, rotateZ: -1.6, y: 0 } : undefined}
          transition={{ duration: 1.2, ease: EASE }}
        >
          <ScaledCanvas width={LIVE_SIZE.width} height={LIVE_SIZE.height}>
            <ConsoleLive />
          </ScaledCanvas>
        </motion.div>
      </div>

      <div className="relative -mt-[4%] xl:absolute xl:-bottom-[clamp(56px,5vw,88px)] xl:left-[-10%] xl:right-[-6%] xl:mt-0">
        <div className="relative" style={{ aspectRatio: "1794 / 558" }}>
          <Image
            src="/landing/scene-features.webp"
            alt=""
            fill
            sizes="(min-width: 1280px) 56vw, 100vw"
            className="object-cover"
            style={{
              maskImage: "linear-gradient(180deg, transparent 0%, #000 22%), linear-gradient(90deg, transparent 0%, #000 16%)",
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
          />
          <ShieldPulse className="absolute left-[51.6%] top-[-4%] w-[6.4%]" />
        </div>
      </div>
    </div>
  );
}

/**
 * The blue shield with a heartbeat, ringed by sonar arcs: the visual promise
 * that the cabin is being watched over.
 */
export function ShieldPulse({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  const gradient = `${useId().replace(/:/g, "")}-shield`;
  return (
    <div className={className} aria-hidden="true">
      <div className="relative aspect-[56/66] w-full">
        {[0, 1, 2].map((ring) => (
          <motion.span
            key={ring}
            className="absolute left-1/2 top-1/2 aspect-square w-[260%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#7fb0ff]/60"
            initial={false}
            animate={reduced ? { opacity: 0.35 } : { scale: [0.55, 1.35], opacity: [0.7, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: ring, ease: "easeOut" }}
          />
        ))}
        <span className="absolute inset-[-30%] rounded-full bg-[radial-gradient(closest-side,rgba(96,160,255,0.45),transparent)]" />
        <svg viewBox="0 0 56 66" className="relative h-full w-full drop-shadow-[0_8px_18px_rgba(18,83,253,0.55)]">
          <defs>
            <linearGradient id={gradient} x1="10" y1="2" x2="46" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#4f97ff" />
              <stop offset="1" stopColor="#1048e8" />
            </linearGradient>
          </defs>
          <path
            d="M28 2 5 10.4v17.4C5 44.6 15 57 28 62c13-5 23-17.4 23-34.2V10.4L28 2Z"
            fill={`url(#${gradient})`}
            stroke="#ffffff"
            strokeOpacity="0.85"
            strokeWidth="2.4"
          />
          <motion.path
            d="M13 33h8l3.4-8 5.2 16 3.6-8H43"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={reduced ? undefined : { pathLength: [0, 1, 1], opacity: [0.45, 1, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      </div>
    </div>
  );
}
