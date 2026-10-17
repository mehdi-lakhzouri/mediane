"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  EllipsisVertical,
  Gauge,
  Globe,
  Heart,
  MapPin,
  ShieldCheck,
  Siren,
  Users,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";
import { useContent } from "../_lib/use-content";
import { ConsoleOverview, OVERVIEW_SIZE } from "./console-overview";
import { Lines } from "../../../lib/i18n/lines";
import { Icon } from "./icons";
import { CountUp, EASE, PopIn, ScaledCanvas, usePrefersReducedMotion } from "./motion";
import { type TypewriterLine, TypewriterHeading } from "./typewriter";
import { WatchVideoButton } from "./watch-video";

/** Stage: the console with its floating cards, drawn at these pixels. */
const STAGE = { width: 960, height: 720 } as const;

const messages = defineMessages({
  en: {
    demo: "Request a demo",
    stage: {
      active: "Active",
      onTheRoad: "On the road • 2 hours ago",
      location: "New York, USA",
      highHeartRate: "High heart rate detected",
      ago: "Mike Taylor • 3 minutes ago",
      viewIncident: "View incident",
      familyNotified: "Family notified",
      familyAlerted: ["Family members", "have been alerted."],
      minutesAgo: "3 minutes ago",
    },
    trustedBy: "Trusted by",
    trustedWho: "forward-thinking organizations",
    customers: "Customers",
  },
  fr: {
    demo: "Demander une démo",
    stage: {
      active: "Actif",
      onTheRoad: "Sur la route • il y a 2 heures",
      location: "New York, États-Unis",
      highHeartRate: "Rythme cardiaque élevé détecté",
      ago: "Mike Taylor • il y a 3 minutes",
      viewIncident: "Voir l’incident",
      familyNotified: "Famille prévenue",
      familyAlerted: ["Les membres de la famille", "ont été alertés."],
      minutesAgo: "Il y a 3 minutes",
    },
    trustedBy: "Ils nous font confiance :",
    trustedWho: "des organisations tournées vers l’avenir",
    customers: "Clients",
  },
});

export function Hero() {
  const t = useMessages(messages);
  const { HERO, demoHref } = useContent();
  /** The headline as the typewriter types it: two lines, the promise in blue. */
  const title = useMemo<readonly TypewriterLine[]>(
    () => [
      [{ text: HERO.title[0] }],
      [{ text: HERO.title[1] }, { text: HERO.accent, className: "lp-accent" }],
    ],
    [HERO],
  );
  const reduced = usePrefersReducedMotion();
  // Always pass both ends: the server renders the start state, and with
  // reduced motion the client must still clear it (instantly).
  const rise = (delay: number, y = 22) => ({
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: reduced ? { duration: 0 } : { duration: 0.8, ease: EASE, delay },
  });

  return (
    <section className="lp-hero-wash relative overflow-hidden" aria-labelledby="hero-title">
      {/* Mountain road artwork under the copy, dissolving into the page. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[118px] left-0 hidden w-[min(43vw,760px)] lg:block"
        style={{
          maskImage:
            "linear-gradient(180deg, transparent 0%, #000 26%, #000 82%, transparent 100%), linear-gradient(90deg, #000 70%, transparent 100%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={reduced ? { duration: 0 } : { duration: 1.4, ease: EASE, delay: 0.2 }}
      >
        <Image
          src="/landing/scene-hero.webp"
          alt=""
          width={1410}
          height={508}
          priority
          sizes="(min-width: 1024px) 46vw, 0px"
          className="h-auto w-full"
        />
      </motion.div>

      <div className="lp-container relative grid gap-10 pb-10 pt-[clamp(28px,3.2vw,52px)] lg:grid-cols-[minmax(0,46%)_minmax(0,1fr)] lg:gap-6 lg:pb-0">
        <div className="relative z-10 lg:pb-[clamp(180px,15vw,270px)]">
          <motion.p className="lp-eyebrow" {...rise(0)}>
            {HERO.eyebrow}
          </motion.p>
          <TypewriterHeading
            id="hero-title"
            className="lp-display mt-[clamp(18px,1.9vw,30px)] text-[clamp(38px,3.56vw,60px)] tracking-[-0.04em]"
            lines={title}
          />
          <motion.p className="lp-lead mt-[clamp(14px,1.4vw,24px)] max-w-[680px] text-[clamp(16px,1.17vw,19.5px)] leading-[1.42]" {...rise(0.28)}>
            {HERO.lead}
          </motion.p>
          <div className="mt-[clamp(24px,2.2vw,36px)] flex flex-wrap gap-4 sm:gap-6">
            <PopIn delay={0.35}>
              <a href={demoHref} className="lp-btn-primary h-[58px] min-w-[220px] px-8 text-[18px] sm:min-w-[240px]">
                {t.demo}
                <ArrowRight size={20} strokeWidth={2.2} />
              </a>
            </PopIn>
            <PopIn delay={0.47}>
              <WatchVideoButton className="lp-btn-secondary h-[58px] min-w-[200px] px-7 text-[18px] sm:min-w-[210px]" />
            </PopIn>
          </div>
          <motion.ul className="mt-[clamp(28px,2.6vw,42px)] grid grid-cols-2 gap-x-4 gap-y-5 min-[1600px]:flex min-[1600px]:flex-nowrap min-[1600px]:gap-0" {...rise(0.48)}>
            {HERO.highlights.map((item, index) => (
              <li
                key={item.icon}
                className={`flex items-center gap-2.5 min-[1600px]:pr-[clamp(10px,0.95vw,16px)] ${
                  index > 0 ? "min-[1600px]:border-l min-[1600px]:border-[var(--lp-line-strong)] min-[1600px]:pl-[clamp(10px,0.95vw,16px)]" : ""
                }`}
              >
                <span className={`lp-tile size-[44px] rounded-[12px] ${item.icon === "siren" ? "lp-tile-red" : ""}`}>
                  <Icon name={item.icon} size={21} />
                </span>
                <span className="whitespace-nowrap text-[clamp(12.5px,0.82vw,14px)] font-medium leading-[1.25] text-[var(--lp-ink-soft)]">
                  {item.label[0]}
                  <br />
                  {item.label[1]}
                </span>
              </li>
            ))}
          </motion.ul>
        </div>

        <div className="relative z-0 -ml-[10.5%] w-[118%] lg:-ml-[6%] lg:-mr-[clamp(20px,4.4vw,74px)] lg:w-auto">
          <ScaledCanvas width={STAGE.width} height={STAGE.height}>
            <Stage />
          </ScaledCanvas>
        </div>
      </div>

      <TrustStrip />
    </section>
  );
}

function Stage() {
  const t = useMessages(messages).stage;
  const reduced = usePrefersReducedMotion();
  const card = (delay: number) => ({
    initial: { opacity: 0, y: 34 },
    animate: { opacity: 1, y: 0 },
    transition: reduced ? { duration: 0 } : { duration: 0.9, ease: EASE, delay },
  });

  return (
    <div className="relative h-full w-full" style={{ perspective: 2200 }}>
      <motion.div
        className="absolute"
        style={{
          left: 90,
          top: 20,
          width: OVERVIEW_SIZE.width,
          height: OVERVIEW_SIZE.height,
          transformOrigin: "100% 50%",
        }}
        initial={{ opacity: 0, rotateY: -32, rotateX: 6, x: 70 }}
        animate={{ opacity: 1, rotateY: -13, rotateX: 4, rotateZ: -1.2, x: 0 }}
        transition={{ duration: 1.3, ease: EASE, delay: 0.3 }}
      >
        <ConsoleOverview />
      </motion.div>

      <motion.div className="lp-glass absolute flex flex-col p-4" style={{ left: 12, top: 566, width: 348, height: 146 }} {...card(0.95)}>
        <div className="flex items-start gap-3">
          <Image
            src="/landing/avatar-mike.webp"
            alt=""
            width={52}
            height={52}
            className="size-[52px] rounded-full object-cover ring-2 ring-white"
          />
          <div className="min-w-0 flex-1">
            <span className="lp-pill lp-pill-green px-2 text-[11px] font-semibold">{t.active}</span>
            <p className="mt-1 text-[16px] font-bold leading-tight text-[var(--lp-ink)]">Mike Taylor</p>
            <p className="text-[12px] text-[var(--lp-muted)]">{t.onTheRoad}</p>
          </div>
          <EllipsisVertical size={18} className="text-[var(--lp-blue)]" />
        </div>
        <div className="mt-3 flex items-center gap-4">
          <Metric icon={<Heart size={16} fill="currentColor" />} value="72" unit="bpm" />
          <Metric icon={<Gauge size={16} />} value="62" unit="km/h" />
          <Metric icon={<MapPin size={16} />} value={t.location} unit="I-95 North" wide />
        </div>
      </motion.div>

      <motion.div
        className="absolute flex flex-col rounded-[20px] border border-[#fbd5da] p-4 shadow-[var(--lp-shadow-float)]"
        style={{ left: 378, top: 574, width: 332, height: 138, background: "linear-gradient(160deg,#fff1f3 0%,#fde7ea 100%)" }}
        {...card(1.1)}
      >
        <div className="flex items-start gap-3">
          <motion.span
            className="lp-tile lp-tile-red size-[46px] rounded-[13px] bg-white/70"
            animate={reduced ? undefined : { scale: [1, 1.07, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <Siren size={22} />
          </motion.span>
          <div>
            <p className="text-[15.5px] font-bold leading-tight text-[#4d0b12]">{t.highHeartRate}</p>
            <p className="text-[12px] text-[var(--lp-muted)]">{t.ago}</p>
          </div>
        </div>
        <div className="mt-auto flex items-end justify-between">
          <span className="pl-[58px] text-[24px] font-extrabold leading-none tracking-[-0.02em] text-[var(--lp-red-strong)]">
            <CountUp value={128} suffix=" bpm" duration={1.2} />
          </span>
          <span className="flex h-[34px] items-center gap-1.5 rounded-[10px] border border-[#e6ecf7] bg-white px-3 text-[12.5px] font-semibold text-[var(--lp-blue)]">
            {t.viewIncident} <ArrowRight size={14} />
          </span>
        </div>
      </motion.div>

      <motion.div className="lp-glass absolute flex gap-3 p-4" style={{ left: 726, top: 584, width: 214, height: 128 }} {...card(1.25)}>
        <span className="lp-tile size-[42px] rounded-[12px]">
          <UsersRound size={20} />
        </span>
        <div>
          <p className="text-[14.5px] font-bold text-[var(--lp-ink)]">{t.familyNotified}</p>
          <p className="mt-1 text-[12px] leading-snug text-[var(--lp-muted)]">
            <Lines lines={t.familyAlerted} />
          </p>
          <p className="mt-2 text-[11.5px] text-[var(--lp-faint)]">{t.minutesAgo}</p>
        </div>
      </motion.div>
    </div>
  );
}

function Metric({
  icon,
  value,
  unit,
  wide = false,
}: {
  icon: React.ReactNode;
  value: string;
  unit: string;
  wide?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${wide ? "border-l border-[var(--lp-line)] pl-4" : ""}`}>
      <span className="grid size-[32px] place-items-center rounded-full bg-[var(--lp-blue-soft)] text-[var(--lp-blue)]">
        {icon}
      </span>
      <span className="leading-tight">
        <span className="block text-[13.5px] font-bold text-[var(--lp-ink)]">{value}</span>
        <span className="block text-[11.5px] text-[var(--lp-muted)]">{unit}</span>
      </span>
    </div>
  );
}

const STAT_ICONS = {
  users: <Users size={20} />,
  family: <UsersRound size={20} />,
  shield: <ShieldCheck size={20} />,
  globe: <Globe size={20} />,
} as const;

function TrustStrip() {
  const t = useMessages(messages);
  const { TRUST_STATS, CUSTOMERS } = useContent();
  return (
    <div className="relative z-10 bg-gradient-to-b from-white/0 via-white/70 to-white/80">
      <div className="lp-container pb-5 pt-3">
        <p className="text-center text-[12px] font-semibold uppercase tracking-[0.28em] text-[var(--lp-muted)]">
          {t.trustedBy} <span className="text-[var(--lp-ink-soft)]">{t.trustedWho}</span>
        </p>
        <div className="mt-4 grid items-center gap-6 xl:grid-cols-[auto_minmax(0,1fr)] xl:gap-0">
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-4 sm:gap-0">
            {TRUST_STATS.map((stat, index) => (
              <li
                key={stat.label}
                className={`flex items-center gap-3 sm:px-[clamp(12px,1.6vw,28px)] ${index > 0 ? "sm:border-l sm:border-[var(--lp-line-strong)]" : "sm:pl-0"}`}
              >
                <span className="lp-tile size-[42px] rounded-[12px]">{STAT_ICONS[stat.icon]}</span>
                <span className="leading-tight">
                  <span className="block text-[19px] font-extrabold tracking-[-0.02em] text-[var(--lp-ink)]">
                    <CountUp value={stat.value} decimals={"decimals" in stat ? stat.decimals : 0} suffix={stat.suffix} />
                  </span>
                  <span className="block text-[13.5px] text-[var(--lp-muted)]">{stat.label}</span>
                </span>
              </li>
            ))}
          </ul>
          <ul
            className="flex flex-wrap items-center justify-center gap-x-[clamp(20px,3vw,56px)] gap-y-3 xl:ml-[clamp(16px,2vw,36px)] xl:flex-nowrap xl:justify-between xl:gap-x-[clamp(12px,1.6vw,32px)] xl:border-l xl:border-[var(--lp-line-strong)] xl:pl-[clamp(20px,2.4vw,44px)]"
            aria-label={t.customers}
          >
            {CUSTOMERS.slice(0, 5).map((name) => (
              <li key={name} className="whitespace-nowrap text-[clamp(17px,1.32vw,23px)] font-bold tracking-[-0.03em] text-[#5a6782]">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
