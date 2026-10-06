"use client";

import { animate, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { DETECTIONS, ESCALATION } from "../_lib/content";
import { Icon } from "./icons";
import { EASE, Reveal, usePrefersReducedMotion, useSeen } from "./motion";

const SEVERITY = {
  Critical: "lp-pill-red",
  Urgent: "lp-pill-amber",
  Warning: "bg-[var(--lp-blue-soft)] text-[var(--lp-blue)]",
  Immediate: "bg-[var(--lp-violet-bg)] text-[var(--lp-violet)]",
} as const;

const TILE = {
  Critical: "lp-tile-red",
  Urgent: "bg-[var(--lp-amber-bg)] text-[var(--lp-amber)]",
  Warning: "",
  Immediate: "lp-tile-violet",
} as const;

export function Detection() {
  return (
    <section id="detection" className="relative scroll-mt-20 overflow-hidden bg-white" aria-labelledby="detection-title">
      <div className="lp-container grid gap-12 py-[clamp(72px,6.4vw,112px)] xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:gap-[clamp(40px,4vw,80px)]">
        <div>
          <Reveal>
            <p className="lp-eyebrow">What the cabin unit detects</p>
            <h2 id="detection-title" className="lp-title mt-[clamp(16px,1.6vw,26px)]">
              Six signals.
              <br />
              <span className="lp-accent">One calm response.</span>
            </h2>
            <p className="lp-lead mt-[clamp(14px,1.2vw,20px)] max-w-[600px]">
              Every alert asks the driver first. Help is called only when they cannot answer — and the time they
              get depends on how serious the event is.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <CountdownDemo />
          </Reveal>
        </div>

        <div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {DETECTIONS.map((item, index) => (
              <li key={item.name}>
                <Reveal delay={index * 0.05} y={18} className="h-full">
                  <div className="flex h-full gap-4 rounded-[18px] border border-[var(--lp-line)] bg-[var(--lp-blue-tint)] p-5 transition-[border-color,background] duration-300 hover:border-[var(--lp-blue-line)] hover:bg-white">
                    <span className={`lp-tile size-12 rounded-[14px] ${TILE[item.severity]}`}>
                      <Icon name={item.icon} size={22} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[17px] font-bold tracking-[-0.015em] text-[var(--lp-ink)]">{item.name}</h3>
                        <span className={`lp-pill text-[11.5px] font-semibold ${SEVERITY[item.severity]}`}>
                          {item.severity}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[14.5px] leading-snug text-[var(--lp-body)]">{item.response}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>

          <Reveal delay={0.1}>
            <ol className="mt-8 grid gap-4 sm:grid-cols-4" aria-label="What happens after an alert">
              {ESCALATION.map((step, index) => (
                <li key={step.title} className="relative">
                  <div className="flex items-center gap-3 sm:block">
                    <span className="grid size-9 flex-none place-items-center rounded-full bg-[var(--lp-ink)] text-[14px] font-bold text-white sm:mb-3">
                      {index + 1}
                    </span>
                    {index < ESCALATION.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-[46px] right-[-8px] top-[18px] hidden h-px bg-[linear-gradient(90deg,var(--lp-blue-line),transparent)] sm:block"
                      />
                    ) : null}
                    <p className="text-[16px] font-bold text-[var(--lp-ink)]">{step.title}</p>
                  </div>
                  <p className="mt-1 pl-12 text-[14px] leading-snug text-[var(--lp-muted)] sm:pl-0">{step.body}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/**
 * The "Are you OK?" countdown the driver sees, replayed when it scrolls into
 * view: thirty seconds compressed into a few, then the all-clear.
 */
function CountdownDemo() {
  const reduced = usePrefersReducedMotion();
  const { ref, seen } = useSeen<HTMLDivElement>(0.5);
  const [remaining, setRemaining] = useState(30);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (!seen || reduced) return;
    const controls = animate(30, 18, {
      duration: 3.2,
      ease: "linear",
      onUpdate: (value) => setRemaining(Math.ceil(value)),
      onComplete: () => setAnswered(true),
    });
    return () => controls.stop();
  }, [seen, reduced]);

  const size = 168;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / 30;

  return (
    <div
      ref={ref}
      className="mt-10 flex flex-col items-center gap-8 rounded-[28px] bg-[linear-gradient(160deg,#2a0b14_0%,#160811_55%,#0d0a1c_100%)] p-8 text-white shadow-[0_40px_80px_-40px_rgba(80,10,30,0.7)] sm:flex-row sm:items-center"
    >
      <div className="relative grid flex-none place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={answered ? "#19b26b" : "#ff5a64"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: answered ? 0 : circumference * (1 - progress) }}
            transition={{ duration: answered ? 0.6 : 0.25, ease: answered ? EASE : "linear" }}
          />
        </svg>
        <div className="absolute text-center" aria-hidden="true">
          {answered ? (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="block text-[22px] font-extrabold text-[#5fe3a1]"
            >
              Safe
            </motion.span>
          ) : (
            <>
              <span className="block text-[52px] font-extrabold leading-none tracking-[-0.04em] lp-tabular">{remaining}</span>
              <span className="text-[13px] text-white/70">seconds</span>
            </>
          )}
        </div>
      </div>
      <div className="text-center sm:text-left">
        <p className="text-[13px] font-semibold uppercase tracking-[0.24em] text-white/55">On the driver’s phone</p>
        <p className="mt-2 text-[28px] font-extrabold tracking-[-0.03em]">
          {answered ? "Thanks — everyone knows you’re OK." : "Are you OK?"}
        </p>
        <p className="mt-2 max-w-[360px] text-[15px] leading-relaxed text-white/70">
          {answered
            ? "One tap cancelled the alert. Nobody was called, and the event is logged as resolved."
            : "If the driver does not answer, their emergency contacts are alerted, then their family."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start" aria-hidden="true">
          <span
            className={`rounded-[12px] px-5 py-2.5 text-[15px] font-bold transition-colors duration-500 ${
              answered ? "bg-[#19b26b] text-white" : "bg-white text-[#160811]"
            }`}
          >
            I’m OK
          </span>
          <span className="rounded-[12px] border border-[#ff5a64]/70 px-5 py-2.5 text-[15px] font-semibold text-[#ffb3b8]">
            Get help now
          </span>
        </div>
        <p className="sr-only">
          Demonstration: the driver is asked whether they are OK and has 30 seconds to answer before help is called.
        </p>
      </div>
    </div>
  );
}
