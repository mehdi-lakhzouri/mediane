"use client";

import { motion } from "framer-motion";
import {
  CarFront,
  ChartColumn,
  HeartPulse,
  MapPin,
  ShieldPlus,
  Siren,
  Users,
} from "lucide-react";
import Image from "next/image";
import { type KeyboardEvent, useRef, useState } from "react";
import { areaPath, pointAt, smoothPath, toPoints } from "../_lib/chart";
import { Lines } from "../../../lib/i18n/lines";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";
import type { EcosystemId, MarketingContent } from "../_lib/content";
import { useContent } from "../_lib/use-content";
import { ConsoleIncident, INCIDENT_SIZE } from "./console-incident";
import { Icon } from "./icons";
import { EASE, Reveal, ScaledCanvas, usePrefersReducedMotion, useSeen } from "./motion";

const messages = defineMessages({
  en: {
    eyebrow: "How CabinGuard works",
    title: ["From detection to response", "in "],
    accent: "three clear steps",
    lead: "CabinGuard turns real-time driver and vehicle signals into life-saving action. We monitor, detect, and notify — keeping drivers, families, and organizations connected and safer on every journey.",
    panel: (label: string) => `${label} in the CabinGuard console`,
    ecosystem: "A complete safety ecosystem",
    signals: [
      ["Heart rate", "& wellness"],
      ["Driving", "behavior"],
      ["Location", "& route"],
      ["Vehicle", "telemetry"],
    ],
    anomaly: {
      title: "High heart rate detected",
      live: "Real time",
      cause: "Possible fatigue or medical issue",
      reading: "128 bpm",
      delta: "↑ 45% above normal range",
      marker: "Anomaly detected",
    },
    response: [
      {
        title: "Family notified",
        time: "2 minutes ago",
        body: "Sarah Taylor has been alerted about Mike’s condition.",
      },
      {
        title: "Live location shared",
        time: "2 minutes ago",
        body: "Real-time location and incident details sent to family.",
      },
      {
        title: "Response in progress",
        time: "5 minutes ago",
        body: "Family and support team coordinating next steps.",
      },
    ],
  },
  fr: {
    eyebrow: "Comment fonctionne CabinGuard",
    title: ["De la détection à l’intervention", "en "],
    accent: "trois étapes claires",
    lead: "CabinGuard transforme les signaux du conducteur et du véhicule en actions qui sauvent des vies. Nous surveillons, détectons et prévenons — pour que conducteurs, familles et organisations restent connectés et plus en sécurité à chaque trajet.",
    panel: (label: string) => `${label} dans la console CabinGuard`,
    ecosystem: "Un écosystème de sécurité complet",
    signals: [
      ["Rythme cardiaque", "et bien-être"],
      ["Comportement", "de conduite"],
      ["Position", "et itinéraire"],
      ["Télémétrie", "du véhicule"],
    ],
    anomaly: {
      title: "Rythme cardiaque élevé détecté",
      live: "Temps réel",
      cause: "Fatigue ou problème médical possible",
      reading: "128 bpm",
      delta: "↑ 45 % au-dessus de la normale",
      marker: "Anomalie détectée",
    },
    response: [
      {
        title: "Famille prévenue",
        time: "Il y a 2 minutes",
        body: "Sarah Taylor a été alertée de l’état de Mike.",
      },
      {
        title: "Position partagée en direct",
        time: "Il y a 2 minutes",
        body: "Position en temps réel et détails de l’incident envoyés à la famille.",
      },
      {
        title: "Intervention en cours",
        time: "Il y a 5 minutes",
        body: "La famille et l’équipe d’assistance coordonnent la suite.",
      },
    ],
  },
});

export function HowItWorks() {
  const t = useMessages(messages);
  const { ECOSYSTEM, STEPS } = useContent();
  const [firstLine, secondLine] = t.title;
  const [audience, setAudience] = useState<EcosystemId>("drivers");
  const activeLabel = ECOSYSTEM.find((item) => item.id === audience)?.title;

  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 overflow-hidden bg-[linear-gradient(180deg,#f9fbff_0%,#f2f7fe_100%)]"
      aria-labelledby="how-title"
    >
      <JourneyBackdrop />

      <div className="lp-container relative pb-[clamp(64px,8vw,128px)] pt-[clamp(40px,3vw,52px)]">
        <div className="flex flex-col gap-10 xl:flex-row xl:items-start xl:justify-between">
          <Reveal className="max-w-[800px]">
            <p className="lp-eyebrow">{t.eyebrow}</p>
            <h2 id="how-title" className="lp-title mt-[clamp(16px,1.6vw,26px)]">
              {firstLine}
              <br />
              {secondLine}
              <span className="lp-accent">{t.accent}</span>
            </h2>
            <p className="lp-lead mt-[clamp(14px,1.2vw,20px)] max-w-[760px]">{t.lead}</p>
          </Reveal>
          <Reveal delay={0.1} className="xl:mr-[-8px] xl:w-[min(42vw,668px)]">
            <EcosystemTabs value={audience} onChange={setAudience} />
          </Reveal>
        </div>

        <div className="mt-[clamp(28px,2.6vw,46px)] grid gap-10 2xl:grid-cols-[minmax(0,1fr)_minmax(0,0.31fr)] 2xl:gap-[30px]">
          <ol className="grid items-start gap-6 lg:grid-cols-3 lg:gap-[clamp(18px,2vw,32px)]">
            {STEPS.map((step, index) => (
              <li key={step.number} className="relative">
                <Reveal delay={0.12 * index}>
                  <StepCard step={step} last={index === STEPS.length - 1} />
                </Reveal>
              </li>
            ))}
          </ol>
          <div className="relative mx-auto w-full max-w-[520px] 2xl:mx-0 2xl:-mt-[38px] 2xl:max-w-none">
            <Reveal delay={0.2} y={40} className="2xl:w-[145%]">
              <div role="tabpanel" aria-label={t.panel(activeLabel ?? "")} style={{ perspective: 2000 }}>
                <div style={{ transform: "rotateY(-12deg) rotateZ(-1.5deg)", transformOrigin: "0% 50%" }}>
                  <ScaledCanvas width={INCIDENT_SIZE.width} height={INCIDENT_SIZE.height}>
                    <ConsoleIncident active={audience} />
                  </ScaledCanvas>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function EcosystemTabs({ value, onChange }: { value: EcosystemId; onChange: (id: EcosystemId) => void }) {
  const t = useMessages(messages);
  const { ECOSYSTEM } = useContent();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + ECOSYSTEM.length) % ECOSYSTEM.length;
    const target = ECOSYSTEM[next];
    if (!target) return;
    onChange(target.id);
    tabs.current[next]?.focus();
  };

  return (
    <div className="rounded-[24px] border border-white/90 bg-white/55 p-[clamp(16px,1.4vw,24px)] shadow-[var(--lp-shadow-card)] backdrop-blur-md">
      <p className="lp-eyebrow pl-1 text-[clamp(11px,0.82vw,13.5px)]" id="ecosystem-label">
        {t.ecosystem}
      </p>
      <div role="tablist" aria-labelledby="ecosystem-label" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-[18px]">
        {ECOSYSTEM.map((item, index) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => onKey(event, index)}
              className={`relative flex flex-col items-center rounded-[18px] px-2 pb-4 pt-4 text-center transition-[background,box-shadow,transform] duration-300 hover:-translate-y-0.5 ${
                selected
                  ? "bg-white shadow-[0_18px_34px_-20px_rgba(18,83,253,0.55)]"
                  : "bg-white/75 shadow-[0_8px_20px_-16px_rgba(16,40,94,0.25)]"
              }`}
            >
              {selected ? (
                <motion.span
                  layoutId="ecosystem-ring"
                  className="absolute inset-0 rounded-[18px] border-2 border-[#4a83ff]"
                  transition={{ duration: 0.4, ease: EASE }}
                />
              ) : null}
              <span className={`lp-tile size-[56px] rounded-[16px] ${item.id === "incidents" ? "lp-tile-red bg-[#fff0f1]" : "bg-[#eef4ff]"}`}>
                <Icon name={item.icon} size={30} strokeWidth={2} />
              </span>
              <span className="mt-3 text-[clamp(15px,1.12vw,19px)] font-bold tracking-[-0.02em] text-[var(--lp-ink)]">
                {item.title}
              </span>
              <span className="mt-1 text-[clamp(13px,0.95vw,16px)] leading-[1.3] text-[var(--lp-body)]">
                <Lines lines={item.body} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepCard({ step, last }: { step: MarketingContent["STEPS"][number]; last: boolean }) {
  return (
    <article className="relative rounded-[22px] border border-white/90 bg-white/85 p-[clamp(18px,1.4vw,24px)] shadow-[var(--lp-shadow-card)] backdrop-blur-md">
      {!last ? <StepArrow /> : null}
      <div className="flex gap-[clamp(12px,1.1vw,18px)]">
        <span className="grid size-[clamp(40px,3vw,50px)] flex-none place-items-center rounded-full bg-[linear-gradient(180deg,#3a7bff,#1048e8)] text-[clamp(17px,1.3vw,22px)] font-bold text-white shadow-[0_0_0_5px_#e9f0ff,0_10px_20px_-8px_rgba(18,83,253,0.6)]">
          {step.number}
        </span>
        <div className="pt-1">
          <p className="lp-eyebrow text-[clamp(11px,0.82vw,14px)] tracking-[0.26em]">{step.eyebrow}</p>
          <h3 className="mt-2 text-[clamp(18px,1.36vw,23px)] font-bold leading-[1.2] tracking-[-0.025em] text-[var(--lp-ink)]">
            <Lines lines={step.title} />
          </h3>
        </div>
      </div>
      <p className="mt-3 text-[clamp(14.5px,1.02vw,17px)] leading-[1.45] text-[var(--lp-body)]">{step.body}</p>
      {step.number === 1 ? <Signals /> : step.number === 2 ? <Anomaly /> : <Timeline />}
    </article>
  );
}

function StepArrow() {
  const reduced = usePrefersReducedMotion();
  return (
    <svg
      className="absolute right-[calc(-1*clamp(18px,2vw,32px)-14px)] top-[78px] z-10 hidden lg:block"
      width="58"
      height="16"
      viewBox="0 0 58 16"
      aria-hidden="true"
    >
      <motion.line
        x1="2"
        y1="8"
        x2="48"
        y2="8"
        stroke="#5b8cff"
        strokeWidth="2"
        strokeDasharray="3 5"
        strokeLinecap="round"
        animate={reduced ? undefined : { strokeDashoffset: [0, -16] }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      <path d="M46 2.5 52.5 8 46 13.5" fill="none" stroke="#2f6bff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SIGNAL_ICONS = [
  <HeartPulse key="heart" size={22} />,
  <Icon key="steering" name="steering" size={22} />,
  <MapPin key="pin" size={22} fill="currentColor" stroke="#fff" />,
  <ChartColumn key="chart" size={22} />,
];

function Signals() {
  const t = useMessages(messages);
  const signals = t.signals.map((label, index) => ({
    label,
    icon: SIGNAL_ICONS[index],
  }));
  return (
    <ul className="mt-5 grid grid-cols-4 gap-1">
      {signals.map((signal, index) => (
        <li key={index} className="flex flex-col items-center text-center">
          <Reveal delay={0.25 + index * 0.07} y={10}>
            <span className="grid size-[clamp(42px,3.1vw,52px)] place-items-center rounded-full border border-[#e3ebf8] bg-white text-[var(--lp-blue)] shadow-[0_10px_20px_-14px_rgba(16,40,94,0.5)]">
              {signal.icon}
            </span>
          </Reveal>
          <span className="mt-2 text-[clamp(12px,0.86vw,14.5px)] leading-[1.25] text-[var(--lp-ink-soft)]">
            <Lines lines={signal.label} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/* Heart rate around the anomaly, sampled every minute from 10:20 to 10:40. */
const HEART = [76, 80, 74, 79, 82, 76, 80, 84, 78, 81, 86, 92, 104, 114, 122, 126, 124, 118, 110, 104, 106];
const ANOMALY_AT = 11;

function Anomaly() {
  const t = useMessages(messages).anomaly;
  const reduced = usePrefersReducedMotion();
  const { ref, seen } = useSeen<HTMLDivElement>(0.3);
  const show = seen;
  const w = 268;
  const h = 96;
  const points = toPoints(HEART, w, h, { min: 50, max: 150, padY: 6 });
  const normal = smoothPath(points.slice(0, ANOMALY_AT + 1));
  const spike = smoothPath(points.slice(ANOMALY_AT));
  const marker = pointAt(points, ANOMALY_AT);

  return (
    <div ref={ref} className="mt-4 space-y-3">
      <div className="relative rounded-[16px] border border-[#fbd9de] bg-[linear-gradient(160deg,#fff6f7_0%,#fdecef_100%)] p-[clamp(12px,0.9vw,14px)]">
        <div className="flex gap-3">
          <motion.span
            className="text-[#e1262f]"
            animate={reduced ? undefined : { scale: [1, 1.1, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Siren size={26} strokeWidth={2} />
          </motion.span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[clamp(12.5px,0.86vw,14.5px)] font-bold text-[var(--lp-ink)]">{t.title}</p>
              <span className="lp-pill flex-none border border-[#f7c3ca] bg-white/70 px-1.5 text-[10.5px] font-semibold text-[#d61f2b]">
                {t.live}
              </span>
            </div>
            <p className="text-[clamp(12px,0.82vw,13.5px)] text-[var(--lp-muted)]">{t.cause}</p>
            <p className="mt-2 text-[clamp(18px,1.4vw,23px)] font-extrabold tracking-[-0.02em] text-[#d61f2b]">{t.reading}</p>
            <p className="text-[clamp(12px,0.82vw,13.5px)] text-[var(--lp-body)]">{t.delta}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[16px] border border-[#e8eef8] bg-white p-3 shadow-[0_10px_24px_-18px_rgba(16,40,94,0.4)]">
        <div className="relative">
          <svg viewBox={`0 0 ${w} ${h + 6}`} className="h-auto w-full" overflow="visible" aria-hidden="true">
            <defs>
              <linearGradient id="lp-anomaly-zone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ff4d57" stopOpacity="0.16" />
                <stop offset="1" stopColor="#ff4d57" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="lp-normal-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1d6bff" stopOpacity="0.14" />
                <stop offset="1" stopColor="#1d6bff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" x2="0" y1="0" y2={h} stroke="#e3e9f3" />
            <line x1="0" x2={w} y1={h} y2={h} stroke="#e3e9f3" />
            <motion.rect
              x={marker.x}
              y="0"
              width={w - marker.x}
              height={h}
              fill="url(#lp-anomaly-zone)"
              initial={{ opacity: 0 }}
              animate={show ? { opacity: 1 } : undefined}
              transition={{ duration: 0.6, delay: 1.3 }}
            />
            <path d={areaPath(normal, points.slice(0, ANOMALY_AT + 1), h)} fill="url(#lp-normal-fill)" />
            <motion.path
              d={normal}
              fill="none"
              stroke="#1d5cff"
              strokeWidth="2.2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={show ? { pathLength: 1 } : undefined}
              transition={{ duration: 1, delay: 0.3, ease: "linear" }}
            />
            <motion.path
              d={spike}
              fill="none"
              stroke="#ef2d35"
              strokeWidth="2.2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={show ? { pathLength: 1 } : undefined}
              transition={{ duration: 0.9, delay: 1.3, ease: EASE }}
            />
            <motion.line
              x1={marker.x}
              x2={marker.x}
              y1={marker.y}
              y2={h}
              stroke="#ef2d35"
              strokeWidth="1.5"
              initial={{ opacity: 0 }}
              animate={show ? { opacity: 1 } : undefined}
              transition={{ delay: 1.3 }}
            />
            <circle cx={marker.x} cy={marker.y} r="4" fill="#0b1533" stroke="#fff" strokeWidth="2" />
          </svg>
          <motion.span
            className="absolute flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-[8px] border border-[#f7c3ca] bg-[#fff1f2] px-2 py-1 text-[11px] font-semibold text-[#d61f2b] shadow-sm"
            style={{ left: `${(marker.x / w) * 100 + 10}%`, top: "-6%" }}
            initial={{ opacity: 0, y: 6 }}
            animate={show ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.4, delay: 1.7, ease: EASE }}
          >
            <MapPin size={11} fill="currentColor" stroke="#fff" /> {t.marker}
          </motion.span>
        </div>
        <div className="mt-1.5 flex justify-between px-1 text-[11px] text-[var(--lp-muted)]">
          {["10:20", "10:25", "10:30", "10:35", "10:40"].map((time) => (
            <span key={time}>{time}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const RESPONSE_ICONS = [
  <Users key="users" size={20} />,
  <MapPin key="pin" size={20} fill="currentColor" stroke="#fff" />,
  <ShieldPlus key="shield" size={20} />,
];

function Timeline() {
  const t = useMessages(messages);
  const response = t.response.map((item, index) => ({
    ...item,
    icon: RESPONSE_ICONS[index],
  }));
  return (
    <ul className="mt-4 space-y-2.5">
      {response.map((item, index) => (
        <li key={index}>
          <Reveal delay={0.3 + index * 0.12} y={14}>
            <div className="flex gap-3 rounded-[14px] border border-[#e8eef8] bg-white p-[clamp(10px,0.9vw,14px)] shadow-[0_10px_22px_-18px_rgba(16,40,94,0.45)]">
              <span className="grid size-[44px] flex-none place-items-center rounded-full border border-[#e3ebf8] bg-[#f6f9ff] text-[var(--lp-blue)]">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[clamp(12.5px,0.86vw,14.5px)] font-bold text-[var(--lp-ink)]">{item.title}</span>
                  <span className="shrink-0 text-[clamp(10.5px,0.72vw,12px)] text-[var(--lp-muted)]">{item.time}</span>
                </span>
                <span className="mt-0.5 block text-[clamp(11.5px,0.8vw,13px)] leading-snug text-[var(--lp-body)]">
                  {item.body}
                </span>
              </span>
            </div>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

/**
 * The road under the steps: the car on the left, and a dashed journey line
 * that runs through the three stages toward the console.
 */
function JourneyBackdrop() {
  const reduced = usePrefersReducedMotion();
  const stops = [
    { x: 34, y: 92.5, icon: <HeartPulse size={22} /> },
    { x: 49.4, y: 95, icon: <CarFront size={22} /> },
    { x: 65, y: 92.5, icon: <Users size={22} /> },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 hidden 2xl:block" aria-hidden="true">
      <div className="absolute bottom-0 left-0 w-[27.3%]" style={{ aspectRatio: "912 / 506" }}>
        <Image
          src="/landing/scene-steps.webp"
          alt=""
          fill
          sizes="28vw"
          className="object-cover"
          style={{ maskImage: "linear-gradient(180deg, transparent 0%, #000 18%), linear-gradient(90deg,#000 80%, transparent 100%)", maskComposite: "intersect", WebkitMaskComposite: "source-in" }}
        />
      </div>
      <svg className="absolute bottom-0 left-0 h-[16%] w-full" viewBox="0 0 1672 150" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lp-journey" x1="0" x2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.5" stopColor="#ffffff" />
            <stop offset="1" stopColor="#9cc0ff" />
          </linearGradient>
        </defs>
        <path d="M400 30 C 500 80, 700 104, 830 102 S 1150 80, 1272 41" fill="none" stroke="#bcd3ff" strokeWidth="10" strokeOpacity="0.35" />
        <motion.path
          d="M400 30 C 500 80, 700 104, 830 102 S 1150 80, 1272 41"
          fill="none"
          stroke="url(#lp-journey)"
          strokeWidth="4"
          strokeDasharray="10 9"
          strokeLinecap="round"
          animate={reduced ? undefined : { strokeDashoffset: [0, -38] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        />
      </svg>
      {stops.map((stop, index) => (
        <motion.span
          key={index}
          className="absolute grid size-[clamp(40px,3.2vw,54px)] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[var(--lp-blue)] shadow-[0_0_0_6px_rgba(255,255,255,0.45),0_14px_30px_-10px_rgba(18,83,253,0.55)]"
          style={{ left: `${stop.x}%`, top: `${stop.y}%` }}
          animate={reduced ? undefined : { y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: index * 0.5, ease: "easeInOut" }}
        >
          {stop.icon}
        </motion.span>
      ))}
      <span className="absolute left-[76.1%] top-[88.4%] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-[#1d5cff] shadow-[0_0_0_6px_rgba(29,92,255,0.18)]" />
    </div>
  );
}
