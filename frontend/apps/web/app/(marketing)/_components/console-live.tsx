"use client";

import { motion } from "framer-motion";
import {
  Building2,
  CarFront,
  ChartColumn,
  ChevronRight,
  ClipboardList,
  Heart,
  LayoutGrid,
  Settings,
  ShieldCheck,
  Siren,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Sparkline } from "./charts";
import {
  type ConsoleNavItem,
  ConsoleSidebar,
  ConsoleTopBar,
  RangePill,
  StatPanel,
} from "./console-chrome";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { consoleMessages } from "../_lib/console.messages";
import { EASE, usePrefersReducedMotion, useSeen } from "./motion";

/** Design size of the live console in the Features section, in pixels. */
export const LIVE_SIZE = { width: 880, height: 530 } as const;

const LIVE_NAV: ConsoleNavItem[] = [
  { key: "overview", icon: LayoutGrid },
  { key: "drivers", icon: UserRound },
  { key: "families", icon: Users },
  { key: "incidents", icon: ClipboardList },
  { key: "analytics", icon: ChartColumn },
  { key: "health", icon: ShieldCheck },
  { key: "organization", icon: Building2 },
  { key: "settings", icon: Settings },
];

export function ConsoleLive() {
  const t = useMessages(consoleMessages);
  return (
    <div className="lp-console relative h-full w-full">
      <ConsoleSidebar items={LIVE_NAV} width={132} gap={41} />
      <div className="absolute inset-y-0 left-[132px] right-0 px-5 pt-4">
        <ConsoleTopBar />
        <div className="mt-3 flex justify-end">
          <RangePill />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2.5">
          <StatPanel icon={<Users size={15} />} label={t.stats.activeDrivers} value="248" delta="12%" trend="up" good note={t.vsLastMonth}>
            <Sparkline values={[6, 9, 8, 12, 11, 15, 13, 18, 22, 26]} width={70} height={32} delay={0.6} />
          </StatPanel>
          <StatPanel icon={<Siren size={15} />} tone="red" label={t.stats.healthAlerts} value="12" delta="54%" trend="up" good={false} note={t.vsLastMonth}>
            <Sparkline values={[4, 7, 5, 9, 7, 11, 9, 14, 12, 16]} color="red" width={70} height={32} delay={0.7} jagged />
          </StatPanel>
          <StatPanel icon={<ShieldCheck size={15} />} label={t.stats.incidents} value="8" delta="27%" trend="down" good note={t.vsLastMonth}>
            <Sparkline values={[3, 6, 5, 8, 7, 11, 9, 13, 12, 16]} color="green" width={70} height={32} delay={0.8} jagged />
          </StatPanel>
          <StatPanel icon={<UsersRound size={15} />} label={t.stats.familiesNotified} value="184" delta="18%" trend="up" good note={t.vsLastMonth}>
            <Sparkline values={[8, 11, 10, 14, 12, 16, 15, 19, 18, 24]} width={70} height={32} delay={0.9} />
          </StatPanel>
        </div>
        <div className="mt-2.5 grid grid-cols-[1fr_1.08fr] gap-2.5">
          <LiveDriversPanel />
          <TripMapPanel />
        </div>
      </div>
    </div>
  );
}

const DRIVERS = [
  { name: "Mike Taylor", avatar: "/landing/avatar-mike.webp", minutesAgo: 2, bpm: 72, elevated: false },
  { name: "Sarah Chen", avatar: "/landing/avatar-sarah.webp", minutesAgo: 5, bpm: 68, elevated: false },
  { name: "James Wilson", avatar: "/landing/avatar-james.webp", minutesAgo: 12, bpm: 91, elevated: true },
  { name: "Emma Davis", avatar: "/landing/avatar-emma.webp", minutesAgo: 18, bpm: 76, elevated: false },
] as const;

/**
 * Nudges a demo reading up and down by a beat or two while it is on screen,
 * so the "live" panel reads as live. Static for reduced motion.
 */
function useLiveReading(base: number, running: boolean) {
  const [value, setValue] = useState(base);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setValue(base + Math.round((Math.random() - 0.5) * 4));
    }, 1600 + Math.random() * 900);
    return () => clearInterval(timer);
  }, [base, running]);
  return value;
}

function LiveDriversPanel() {
  const t = useMessages(consoleMessages).live;
  const reduced = usePrefersReducedMotion();
  const { ref, seen } = useSeen<HTMLDivElement>(0.2);
  return (
    <div ref={ref} className="lp-panel p-3.5">
      <div className="flex items-start justify-between">
        <div className="flex gap-2">
          <span className="relative mt-1 grid size-3 place-items-center">
            <motion.span
              className="absolute inset-0 rounded-full bg-[#19b26b]/40"
              animate={reduced ? undefined : { scale: [1, 2.1], opacity: [0.7, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
            <span className="size-2.5 rounded-full border-2 border-white bg-[#19b26b] shadow" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-[#14203f]">{t.title}</p>
            <p className="text-[9.5px] text-[#8592ab]">{t.subtitle}</p>
          </div>
        </div>
        <span className="rounded-[8px] border border-[#dbe5fb] px-2 py-1 text-[9.5px] font-semibold text-[#1253fd]">
          {t.viewAll}
        </span>
      </div>
      <ul className="mt-2.5 divide-y divide-[#eef2f9]">
        {DRIVERS.map((driver) => (
          <DriverRow key={driver.name} driver={driver} live={seen && !reduced} />
        ))}
      </ul>
    </div>
  );
}

function DriverRow({ driver, live }: { driver: (typeof DRIVERS)[number]; live: boolean }) {
  const t = useMessages(consoleMessages).live;
  const bpm = useLiveReading(driver.bpm, live);
  const elevated = driver.elevated;
  return (
    <li className="flex items-center gap-2.5 py-[7px]">
      <Image src={driver.avatar} alt="" width={36} height={36} className="size-9 rounded-full object-cover" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[12px] font-bold text-[#14203f]">{driver.name}</span>
        <span className="block text-[9.5px] text-[#8592ab]">{t.onTheRoad(t.minutesAgo(driver.minutesAgo))}</span>
      </span>
      <span className="flex w-[62px] items-center gap-1 text-[11px] font-semibold text-[#3b4a6b]">
        <motion.span
          className="text-[#1d5cff]"
          animate={live ? { scale: [1, 1.22, 1] } : undefined}
          transition={{ duration: 60 / bpm, repeat: Infinity, ease: "easeOut" }}
        >
          <Heart size={12} strokeWidth={2.4} />
        </motion.span>
        <span className="lp-tabular">{bpm}</span> bpm
      </span>
      <span className={`lp-pill w-[54px] justify-center text-[8.5px] font-semibold ${elevated ? "lp-pill-amber" : "lp-pill-green"}`}>
        {elevated ? t.elevated : t.normal}
      </span>
    </li>
  );
}

/* A small city map: water, parks and streets, with the trip drawn on top. */
const MAP = { width: 335, height: 214 } as const;
const ROUTE =
  "M18 196 C 34 176, 44 158, 70 156 S 112 170, 132 146 S 160 118, 190 124 S 236 120, 258 98 S 300 70, 318 60";

function TripMapPanel() {
  const t = useMessages(consoleMessages).live;
  const reduced = usePrefersReducedMotion();
  const { ref, seen } = useSeen<HTMLDivElement>(0.3);
  const show = seen;

  return (
    <div ref={ref} className="lp-panel relative p-3.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-[13px] font-bold text-[#14203f]">
          <ShieldCheck size={15} className="text-[#1253fd]" /> {t.map}
        </p>
        <span className="text-[10px] font-semibold text-[#1253fd]">{t.tripDetails}</span>
      </div>
      <div className="relative mt-2.5 overflow-hidden rounded-[12px]" style={{ width: MAP.width, height: MAP.height }}>
        <svg width={MAP.width} height={MAP.height} viewBox={`0 0 ${MAP.width} ${MAP.height}`} aria-hidden="true">
          <rect width={MAP.width} height={MAP.height} fill="#eef3f8" />
          <path d="M0 120 C 30 128, 40 160, 26 214 L0 214Z" fill="#d3e5f7" />
          <path d="M300 0 C 296 30, 330 46, 372 40 L372 0Z" fill="#d3e5f7" />
          <rect x="150" y="22" width="70" height="44" rx="10" fill="#dcefe0" />
          <rect x="78" y="176" width="64" height="30" rx="8" fill="#dcefe0" />
          <rect x="270" y="150" width="90" height="40" rx="10" fill="#e2f1e4" />
          <g stroke="#ffffff" strokeWidth="6" fill="none" strokeLinecap="round">
            <path d="M0 70 C 90 64, 180 92, 372 84" />
            <path d="M40 0 C 52 80, 100 140, 120 214" />
            <path d="M230 0 C 226 70, 250 150, 236 214" />
            <path d="M0 176 C 120 180, 250 196, 372 128" />
          </g>
          <g stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.9">
            <path d="M140 0 L170 214" />
            <path d="M0 30 L372 20" />
            <path d="M300 214 L340 0" />
            <path d="M0 120 L372 160" />
          </g>
          <path d={ROUTE} fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" />
          <motion.path
            d={ROUTE}
            fill="none"
            stroke="#1d5cff"
            strokeWidth="4.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={show ? { pathLength: 1 } : undefined}
            transition={{ duration: 2, delay: 0.5, ease: EASE }}
          />
          <circle cx="18" cy="196" r="6" fill="#ffffff" stroke="#1d5cff" strokeWidth="3" />
        </svg>

        <motion.span
          className="absolute left-0 top-0 grid h-[18px] w-[30px] place-items-center rounded-[7px] bg-[#1d5cff] text-white shadow-[0_6px_12px_-4px_rgba(29,92,255,0.7)]"
          style={{ offsetPath: `path("${ROUTE}")`, offsetRotate: "0deg" }}
          initial={{ offsetDistance: "0%" }}
          animate={show ? { offsetDistance: "70%" } : undefined}
          transition={{ duration: 2.2, delay: 0.5, ease: EASE }}
        >
          <CarFront size={12} strokeWidth={2.4} />
        </motion.span>

        <div className="absolute" style={{ left: 318 - 24, top: 60 - 24 }}>
          <span className="relative grid size-12 place-items-center">
            {[0, 0.8].map((delay) => (
              <motion.span
                key={delay}
                className="absolute inset-0 rounded-full bg-[#ef2d35]/25"
                animate={reduced ? undefined : { scale: [0.5, 1.5], opacity: [0.8, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, delay, ease: "easeOut" }}
              />
            ))}
            <span className="absolute inset-[10px] rounded-full bg-[#ef2d35]/20" />
            <svg width="22" height="28" viewBox="0 0 22 28" className="relative -translate-y-2" aria-hidden="true">
              <path d="M11 27s9-9.2 9-16a9 9 0 0 0-18 0c0 6.8 9 16 9 16Z" fill="#ef2d35" stroke="#fff" strokeWidth="2" />
              <rect x="10" y="5.5" width="2" height="6.5" rx="1" fill="#fff" />
              <circle cx="11" cy="15" r="1.2" fill="#fff" />
            </svg>
          </span>
        </div>

        <motion.div
          className="absolute bottom-2.5 right-2.5 flex w-[238px] items-center gap-2.5 rounded-[12px] bg-white px-3 py-2.5 shadow-[0_14px_30px_-14px_rgba(16,40,94,0.45)]"
          initial={{ opacity: 0, y: 10 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, delay: 2.3, ease: EASE }}
        >
          <span className="lp-tile size-[30px] rounded-[9px]">
            <CarFront size={15} />
          </span>
          <span className="flex-1 leading-tight">
            <span className="block text-[11px] font-bold text-[#14203f]">{t.fatigue}</span>
            <span className="block text-[9.5px] text-[#7a87a3]">{t.fatigueWhen}</span>
          </span>
          <ChevronRight size={14} className="text-[#3b4a6b]" />
        </motion.div>
      </div>
    </div>
  );
}
