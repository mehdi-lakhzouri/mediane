"use client";

import { motion, type MotionValue, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import { APP_POINTS } from "../_lib/content";
import { Icon } from "./icons";
import { Reveal, usePrefersReducedMotion } from "./motion";

export function DriverApp() {
  const stage = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: stage, offset: ["start end", "end start"] });
  const rise = useTransform(scrollYProgress, [0, 1], [70, -70]);
  const sink = useTransform(scrollYProgress, [0, 1], [-30, 40]);

  return (
    <section
      id="app"
      className="relative scroll-mt-20 overflow-hidden bg-[linear-gradient(180deg,#081c43_0%,#061631_100%)] text-white"
      aria-labelledby="app-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_78%_45%,rgba(40,110,255,0.35),transparent_70%),radial-gradient(40%_50%_at_10%_100%,rgba(90,60,245,0.22),transparent_70%)]"
      />
      <div className="lp-container relative grid items-center gap-14 py-[clamp(72px,6.4vw,112px)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div>
          <Reveal>
            <p className="lp-eyebrow text-[#8fb4ff]">The driver app</p>
            <h2 id="app-title" className="lp-title mt-[clamp(16px,1.6vw,26px)] text-white">
              Help is one tap away.
              <br />
              <span className="text-[#6ea2ff]">So is the all-clear.</span>
            </h2>
            <p className="lp-lead mt-[clamp(14px,1.2vw,20px)] max-w-[560px] text-white/72">
              The CabinGuard app pairs with the cabin unit, answers its alerts and keeps the driver in charge of
              who is told what.
            </p>
          </Reveal>
          <ul className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {APP_POINTS.map((point, index) => (
              <li key={point.title}>
                <Reveal delay={0.06 * index} y={16} className="flex gap-4">
                  <span className="grid size-11 flex-none place-items-center rounded-[13px] border border-white/10 bg-white/[0.07] text-[#8fb4ff]">
                    <Icon name={point.icon} size={20} />
                  </span>
                  <span>
                    <h3 className="text-[17px] font-bold tracking-[-0.015em]">{point.title}</h3>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-white/65">{point.body}</p>
                  </span>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        <div ref={stage} className="relative mx-auto flex w-full max-w-[680px] items-center justify-center py-6">
          <Phone src="/landing/app-home.webp" alt="CabinGuard home screen showing protection active" offset={reduced ? undefined : sink} className="hidden w-[30%] translate-x-[18%] -rotate-[7deg] opacity-80 sm:block" />
          <Phone
            src="/landing/app-alert.webp"
            alt="Are you OK? countdown with 22 seconds left and an I’m OK button"
            offset={reduced ? undefined : rise}
            className="relative z-10 w-[min(72%,300px)] sm:w-[38%]"
            priority
          />
          <Phone src="/landing/app-notifications.webp" alt="Notification center with safety, family and security alerts" offset={reduced ? undefined : sink} className="hidden w-[30%] -translate-x-[18%] rotate-[7deg] opacity-80 sm:block" />
        </div>
      </div>
    </section>
  );
}

function Phone({
  src,
  alt,
  offset,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  /** Scroll-linked drift; none for reduced motion. */
  offset?: MotionValue<number>;
  className?: string;
  priority?: boolean;
}) {
  return (
    <motion.figure style={{ y: offset ?? 0 }} className={`flex-none ${className ?? ""}`}>
      <div className="rounded-[clamp(28px,3vw,44px)] border border-white/15 bg-[#05070d] p-[clamp(6px,0.55vw,9px)] shadow-[0_50px_90px_-30px_rgba(0,0,0,0.75),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
        <Image
          src={src}
          alt={alt}
          width={590}
          height={1279}
          priority={priority}
          sizes="(min-width: 1024px) 20vw, 60vw"
          className="h-auto w-full rounded-[clamp(22px,2.5vw,36px)]"
        />
      </div>
    </motion.figure>
  );
}
